const crypto = require('node:crypto');
const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');
const web = require('../_shared/public-knowledge.cjs');
function send(context, status, body) { context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body }; }
function safeError(error) { return error?.message?.startsWith('PUBLIC_') ? error.message : 'page-fetch-failed'; }
async function discoverPages(config, robots) {
  const queue = robots.sitemaps.map((url) => ({ url, depth: 0 })).sort((a, b) => web.sitemapPriority(a.url) - web.sitemapPriority(b.url)); const seenSitemaps = new Set(); const seenPages = new Set(); const pageUrls = []; const preExclusions = []; const sitemapsFound = [...robots.sitemaps]; const sitemapsProcessed = [];
  while (queue.length && seenSitemaps.size < web.MAX_SITEMAPS) {
    const current = queue.shift(); if (current.depth > config.maxDepth || seenSitemaps.has(current.url)) continue; seenSitemaps.add(current.url);
    if (config.deadline && Date.now() >= config.deadline) break;
    let parsed; try { const remaining = config.deadline ? Math.max(500, Math.min(config.timeoutMs, config.deadline - Date.now())) : config.timeoutMs; parsed = web.parseSitemapDocument((await web.fetchAllowed(current.url, { ...config, timeoutMs: remaining })).body); sitemapsProcessed.push(current.url); } catch { continue; }
    if (parsed.kind === 'sitemapindex') for (const child of parsed.urls) { try { if (!seenSitemaps.has(child) && web.allowedHost(new URL(child).hostname) && current.depth < config.maxDepth) { queue.push({ url: child, depth: current.depth + 1 }); queue.sort((a, b) => web.sitemapPriority(a.url) - web.sitemapPriority(b.url)); sitemapsFound.push(child); } } catch {} }
    if (parsed.kind === 'urlset') for (const page of parsed.urls) if (!seenPages.has(page) && web.isAllowedPageUrl(page)) { seenPages.add(page); const sourcePriority = web.sitemapPriority(current.url); const sourceSitemap = current.url; const prefilter = web.prefilterUrl(page, config, sourceSitemap); if (!prefilter.allowed) preExclusions.push({ url: page, sourceSitemap, reason: prefilter.reason, stage: 'pre-download' }); else if (pageUrls.length < web.MAX_DISCOVERED_URLS) pageUrls.push({ url: page, sourcePriority, sourceSitemap }); }
  }
  return { items: pageUrls, preExclusions, sitemapsFound, sitemapsProcessed };
}
async function processPages(items, config, robots, deadline) {
  const results = new Array(items.length); let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++; if (index >= items.length) return;
      const item = items[index]; const prefilter = web.prefilterUrl(item.url, config, item.sourceSitemap);
      if (!prefilter.allowed) { results[index] = { type: 'exclusion', url: item.url, reason: prefilter.reason }; continue; }
      if (Date.now() >= deadline) { results[index] = { type: 'pending', url: item.url, sourceSitemap: item.sourceSitemap, reason: 'time-budget-exhausted' }; continue; }
      try {
        const validated = await web.validatePublicUrl(item.url, config.rootUrl);
        if (!web.robotsAllows(validated.pathname, robots)) { results[index] = { type: 'exclusion', url: validated.href, reason: 'robots-disallowed' }; continue; }
        const remaining = Math.max(500, Math.min(config.timeoutMs, deadline - Date.now())); const response = await web.fetchAllowed(validated.href, { ...config, timeoutMs: remaining });
        if (!/text\/html|application\/xhtml\+xml/i.test(response.contentType) && !/^\s*<(!doctype\s+html|html\b)/i.test(response.body)) { results[index] = { type: 'exclusion', url: response.url, reason: 'non-html-content' }; continue; }
        const page = web.extractPage(response.body, response.url); const quality = web.classifyPage(page, item.sourcePriority, config);
        if (!web.hasUsefulPageContent(page)) { results[index] = { type: 'exclusion', url: page.url, reason: 'insufficient-or-non-corporate-text', category: quality.category }; continue; }
        if (!quality.eligible) { results[index] = { type: 'exclusion', url: page.url, reason: quality.reason, category: quality.category, language: quality.language }; continue; }
        results[index] = { type: 'page', page: { ...page, ...quality, sourcePriority: item.sourcePriority } };
      } catch (error) { results[index] = { type: 'error', url: item.url, sourceSitemap: item.sourceSitemap, reason: safeError(error) }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(config.maxConcurrency, items.length) }, () => worker()));
  return results;
}
module.exports = async function knowledgeWebSync(context, req) {
  const principal = getPrincipalFromRequest(req); if (!principal) return send(context, 401, { ok: false, syncStatus: 'authentication-required' }); if (!isAdminPrincipal(principal)) return send(context, 403, { ok: false, syncStatus: 'admin-access-required' });
  const config = web.getConfig(); if (!config.configured) return send(context, 503, { ok: false, syncStatus: 'storage-not-configured' });
  const startedAt = Date.now(); const deadline = startedAt + config.budgetMs;
  try {
    const robots = web.parseRobots((await web.fetchAllowed(`${config.rootUrl}/robots.txt`, config)).body, config.rootUrl); if (!robots.sitemaps.length) return send(context, 503, { ok: false, syncStatus: 'robots-sitemap-unavailable' });
    const discovery = await discoverPages({ ...config, deadline, timeoutMs: Math.min(config.timeoutMs, Math.max(500, deadline - Date.now())) }, robots); if (Date.now() >= deadline) return send(context, 504, { ok: false, syncStatus: 'time-budget-exhausted', discoveredCount: discovery.items.length, pendingCount: discovery.items.length, preExclusions: discovery.preExclusions, sitemapsFound: discovery.sitemapsFound, sitemapsProcessed: discovery.sitemapsProcessed });
    const results = await processPages(discovery.items, config, robots, deadline); const pages = []; const errors = []; const exclusions = [...discovery.preExclusions]; let pendingCount = 0;
    for (const result of results) { if (!result) continue; if (result.type === 'page') pages.push(result.page); else if (result.type === 'error') errors.push({ url: String(result.url).slice(0, 300), sourceSitemap: result.sourceSitemap, reason: result.reason }); else if (result.type === 'pending') { pendingCount += 1; exclusions.push({ url: String(result.url).slice(0, 300), sourceSitemap: result.sourceSitemap, reason: result.reason }); } else exclusions.push({ url: String(result.url).slice(0, 300), sourceSitemap: result.sourceSitemap, reason: result.reason, ...(result.category ? { category: result.category } : {}), ...(result.language ? { language: result.language } : {}) }); }
    const partial = pendingCount > 0 || errors.length > 0;
    const fingerprints = new Map(); const uniquePages = [];
    for (const page of pages) { const fingerprint = web.contentFingerprint(page.text); const duplicate = fingerprints.get(fingerprint); if (duplicate) { const preferCurrent = page.language === 'es' && duplicate.language !== 'es'; if (preferCurrent) { const oldIndex = uniquePages.findIndex((candidate) => candidate.url === duplicate.url); if (oldIndex >= 0) uniquePages.splice(oldIndex, 1); exclusions.push({ url: duplicate.url, reason: 'duplicate-prefer-spanish' }); fingerprints.set(fingerprint, { ...page }); } else { exclusions.push({ url: page.url, reason: 'duplicate-content', duplicateOf: duplicate.url }); continue; } } else fingerprints.set(fingerprint, { ...page }); uniquePages.push(page); }
    const selected = uniquePages.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url)).slice(0, config.maxPages); for (const page of uniquePages.slice(config.maxPages)) exclusions.push({ url: page.url, reason: 'page-limit', category: page.category, language: page.language });
    if (!selected.length) return send(context, 422, { ok: false, syncStatus: 'empty-candidate', pageCount: 0, errors, exclusions, discoveredCount: discovery.items.length });
    if (Date.now() >= deadline) return send(context, 504, { ok: false, syncStatus: 'time-budget-exhausted', discoveredCount: discovery.items.length, downloadedCount: pages.length, pendingCount, errors, exclusions, sitemapsFound: discovery.sitemapsFound, sitemapsProcessed: discovery.sitemapsProcessed });
    const candidate = web.buildCandidate(selected); candidate.status = partial ? 'partial' : 'complete'; candidate.diagnostics = { discoveredCount: discovery.items.length, downloadedCount: pages.length, pendingCount, errors, exclusions, sitemapsFound: discovery.sitemapsFound, sitemapsProcessed: discovery.sitemapsProcessed };
    const id = crypto.createHash('sha256').update(JSON.stringify(candidate)).digest('hex').slice(0, 24); const client = web.createBlobClient(config, config.writeSas); await client.getBlockBlobClient(`${web.PUBLIC_PREFIX}candidates/${id}.json`).uploadData(Buffer.from(JSON.stringify(candidate)), { conditions: { ifNoneMatch: '*' }, blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' } });
    const coverage = selected.reduce((result, page) => { result[page.category] = (result[page.category] || 0) + 1; return result; }, {});
    return send(context, 200, { ok: true, syncStatus: partial ? 'candidate-created-partial' : 'candidate-created', candidateStatus: candidate.status, candidateId: id, pageCount: candidate.pageCount, chunkCount: candidate.pages.reduce((sum, page) => sum + page.chunks.length, 0), discoveredCount: discovery.items.length, downloadedCount: pages.length, pendingCount, durationMs: Date.now() - startedAt, sitemapsFound: discovery.sitemapsFound, sitemapsProcessed: discovery.sitemapsProcessed, coverage, errors, exclusions });
  } catch (error) { context.log?.(`[knowledge-web-sync] ${error?.code || 'sync-error'}`); return send(context, 503, { ok: false, syncStatus: error?.code?.startsWith('PUBLIC_') ? error.code.toLowerCase() : 'sync-error' }); }
};
module.exports.discoverPages = discoverPages;
module.exports.processPages = processPages;
