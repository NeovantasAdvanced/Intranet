const crypto = require('node:crypto');
const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');
const web = require('../_shared/public-knowledge.cjs');
function send(context, status, body) { context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body }; }
function safeError(error) { return error?.message?.startsWith('PUBLIC_') ? error.message : 'page-fetch-failed'; }
async function discoverPages(config, robots) {
  const queue = robots.sitemaps.map((url) => ({ url, depth: 0 })); const seenSitemaps = new Set(); const seenPages = new Set(); const pageUrls = [];
  while (queue.length && seenSitemaps.size < web.MAX_SITEMAPS) {
    const current = queue.shift(); if (current.depth > config.maxDepth || seenSitemaps.has(current.url)) continue; seenSitemaps.add(current.url);
    let parsed; try { parsed = web.parseSitemapDocument((await web.fetchAllowed(current.url, config)).body); } catch { continue; }
    if (parsed.kind === 'sitemapindex') for (const child of parsed.urls) { try { if (!seenSitemaps.has(child) && web.allowedHost(new URL(child).hostname) && current.depth < config.maxDepth) queue.push({ url: child, depth: current.depth + 1 }); } catch {} }
    if (parsed.kind === 'urlset') for (const page of parsed.urls) if (!seenPages.has(page) && web.isAllowedPageUrl(page)) { seenPages.add(page); pageUrls.push({ url: page, sourcePriority: web.sitemapPriority(current.url) }); }
  }
  return pageUrls.slice(0, web.MAX_DISCOVERED_URLS);
}
module.exports = async function knowledgeWebSync(context, req) {
  const principal = getPrincipalFromRequest(req); if (!principal) return send(context, 401, { ok: false, syncStatus: 'authentication-required' }); if (!isAdminPrincipal(principal)) return send(context, 403, { ok: false, syncStatus: 'admin-access-required' });
  const config = web.getConfig(); if (!config.configured) return send(context, 503, { ok: false, syncStatus: 'storage-not-configured' });
  try {
    const robots = web.parseRobots((await web.fetchAllowed(`${config.rootUrl}/robots.txt`, config)).body, config.rootUrl); if (!robots.sitemaps.length) return send(context, 503, { ok: false, syncStatus: 'robots-sitemap-unavailable' });
    const discovered = await discoverPages(config, robots); const pages = []; const errors = []; const exclusions = []; const fingerprints = new Map();
    for (const item of discovered) {
      try {
        const validated = await web.validatePublicUrl(item.url, config.rootUrl);
        if (!web.robotsAllows(validated.pathname, robots)) { exclusions.push({ url: validated.href, reason: 'robots-disallowed' }); continue; }
        const response = await web.fetchAllowed(validated.href, config);
        if (!/text\/html|application\/xhtml\+xml/i.test(response.contentType) && !/^\s*<(!doctype\s+html|html\b)/i.test(response.body)) { exclusions.push({ url: response.url, reason: 'non-html-content' }); continue; }
        const page = web.extractPage(response.body, response.url); const quality = web.classifyPage(page, item.sourcePriority, config);
        if (!web.hasUsefulPageContent(page)) { exclusions.push({ url: page.url, reason: 'insufficient-or-non-corporate-text', category: quality.category }); continue; }
        if (!quality.eligible) { exclusions.push({ url: page.url, reason: quality.reason, category: quality.category, language: quality.language }); continue; }
        const fingerprint = web.contentFingerprint(page.text); const duplicate = fingerprints.get(fingerprint);
        if (duplicate) { const preferCurrent = quality.language === 'es' && duplicate.language !== 'es'; if (preferCurrent) { const oldIndex = pages.findIndex((candidate) => candidate.url === duplicate.url); if (oldIndex >= 0) pages.splice(oldIndex, 1); exclusions.push({ url: duplicate.url, reason: 'duplicate-prefer-spanish' }); fingerprints.set(fingerprint, { ...quality, url: page.url }); } else { exclusions.push({ url: page.url, reason: 'duplicate-content', duplicateOf: duplicate.url }); continue; } }
        else fingerprints.set(fingerprint, { ...quality, url: page.url });
        pages.push({ ...page, ...quality, sourcePriority: item.sourcePriority });
      } catch (error) { errors.push({ url: String(item.url).slice(0, 300), reason: safeError(error) }); }
    }
    const selected = pages.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url)).slice(0, config.maxPages);
    for (const page of pages.slice(config.maxPages)) exclusions.push({ url: page.url, reason: 'page-limit', category: page.category, language: page.language });
    if (!selected.length) return send(context, 422, { ok: false, syncStatus: 'empty-candidate', pageCount: 0, errors, exclusions });
    const candidate = web.buildCandidate(selected); const id = crypto.createHash('sha256').update(JSON.stringify(candidate)).digest('hex').slice(0, 24); const client = web.createBlobClient(config, config.writeSas); await client.getBlockBlobClient(`${web.PUBLIC_PREFIX}candidates/${id}.json`).uploadData(Buffer.from(JSON.stringify(candidate)), { conditions: { ifNoneMatch: '*' }, blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' } });
    const coverage = selected.reduce((result, page) => { result[page.category] = (result[page.category] || 0) + 1; return result; }, {});
    return send(context, 200, { ok: true, syncStatus: 'candidate-created', candidateId: id, pageCount: candidate.pageCount, chunkCount: candidate.pages.reduce((sum, page) => sum + page.chunks.length, 0), coverage, errors, exclusions });
  } catch (error) { context.log?.(`[knowledge-web-sync] ${error?.code || 'sync-error'}`); return send(context, 503, { ok: false, syncStatus: error?.code?.startsWith('PUBLIC_') ? error.code.toLowerCase() : 'sync-error' }); }
};
module.exports.discoverPages = discoverPages;
