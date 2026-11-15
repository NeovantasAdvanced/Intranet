const crypto = require('node:crypto');
const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');
const web = require('../_shared/public-knowledge.cjs');

function send(context, status, body) { context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body }; }
module.exports = async function knowledgeWebSync(context, req) {
  const principal = getPrincipalFromRequest(req); if (!principal) return send(context, 401, { ok: false, syncStatus: 'authentication-required' }); if (!isAdminPrincipal(principal)) return send(context, 403, { ok: false, syncStatus: 'admin-access-required' });
  const config = web.getConfig(); if (!config.configured) return send(context, 503, { ok: false, syncStatus: 'storage-not-configured' });
  try {
    const robotsResponse = await web.fetchAllowed(`${config.rootUrl}/robots.txt`, config); const robots = web.parseRobots(robotsResponse.body, config.rootUrl); if (!robots.sitemaps.length) return send(context, 503, { ok: false, syncStatus: 'robots-sitemap-unavailable' });
    const sitemapResponse = await web.fetchAllowed(robots.sitemaps[0], config); const urls = web.parseSitemap(sitemapResponse.body).slice(0, config.maxPages); const pages = []; const errors = []; const exclusions = [];
    for (const url of urls) { try { const validated = await web.validatePublicUrl(url, config.rootUrl); if (!web.robotsAllows(validated.pathname, robots)) { exclusions.push({ url: validated.href, reason: 'robots-disallowed' }); continue; } const pageResponse = await web.fetchAllowed(validated.href, config); const page = web.extractPage(pageResponse.body, pageResponse.url); if (page.text.length < 80) { exclusions.push({ url: page.url, reason: 'insufficient-text' }); continue; } pages.push(page); } catch (error) { errors.push({ url: String(url).slice(0, 300), reason: error?.message?.startsWith('PUBLIC_') ? error.message : 'page-fetch-failed' }); } }
    if (!pages.length) return send(context, 422, { ok: false, syncStatus: 'empty-candidate', pageCount: 0, errors, exclusions });
    const candidate = web.buildCandidate(pages); const id = crypto.createHash('sha256').update(JSON.stringify(candidate)).digest('hex').slice(0, 24); const blobName = `${web.PUBLIC_PREFIX}candidates/${id}.json`; const client = web.createBlobClient(config, config.writeSas); await client.getBlockBlobClient(blobName).uploadData(Buffer.from(JSON.stringify(candidate)), { conditions: { ifNoneMatch: '*' }, blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' } });
    return send(context, 200, { ok: true, syncStatus: 'candidate-created', candidateId: id, pageCount: candidate.pageCount, chunkCount: candidate.pages.reduce((sum, page) => sum + page.chunks.length, 0), errors, exclusions });
  } catch (error) { context.log?.(`[knowledge-web-sync] ${error?.code || 'sync-error'}`); return send(context, 503, { ok: false, syncStatus: error?.code?.startsWith('PUBLIC_') ? error.code.toLowerCase() : 'sync-error' }); }
};
