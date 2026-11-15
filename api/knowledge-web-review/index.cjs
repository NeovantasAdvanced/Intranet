const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');
const web = require('../_shared/public-knowledge.cjs');
function send(context, status, body) { context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body }; }
module.exports = async function knowledgeWebReview(context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!principal) return send(context, 401, { ok: false, reviewStatus: 'authentication-required' });
  if (!isAdminPrincipal(principal)) return send(context, 403, { ok: false, reviewStatus: 'admin-access-required' });
  const candidateId = typeof req?.query?.candidateId === 'string' ? req.query.candidateId.trim() : '';
  if (!/^[a-f0-9]{24}$/.test(candidateId)) return send(context, 400, { ok: false, reviewStatus: 'invalid-candidate' });
  const config = web.getConfig();
  if (!config.readConfigured) return send(context, 503, { ok: false, reviewStatus: 'storage-not-configured' });
  try {
    const client = web.createBlobClient(config, config.readSas);
    const candidate = await web.readBlobJson(client, `${web.PUBLIC_PREFIX}candidates/${candidateId}.json`);
    if (!candidate || candidate.schemaVersion !== web.PUBLIC_SCHEMA_VERSION || !Array.isArray(candidate.pages)) return send(context, 422, { ok: false, reviewStatus: 'candidate-invalid' });
    const pages = candidate.pages.slice(0, config.maxPages).map((page) => ({ title: page.title, url: page.url, category: page.category || 'other', language: page.language || 'unknown', headings: Array.isArray(page.headings) ? page.headings.slice(0, 20) : [], chunkCount: Array.isArray(page.chunks) ? page.chunks.length : 0, preview: Array.isArray(page.chunks) ? page.chunks.slice(0, 2).map((chunk) => String(chunk.text || '').slice(0, 300)) : [] }));
    const coverage = pages.reduce((result, page) => { result[page.category] = (result[page.category] || 0) + 1; return result; }, {});
    return send(context, 200, { ok: true, reviewStatus: 'available', candidateId, candidateStatus: candidate.status || 'complete', syncedAt: candidate.syncedAt, diagnostics: candidate.diagnostics || null, pageCount: pages.length, coverage, pages });
  } catch (error) {
    context.log?.(`[knowledge-web-review] ${JSON.stringify({ errorCode: error?.code || 'REVIEW_FAILED', statusCode: error?.statusCode || error?.status || null })}`);
    return send(context, error?.statusCode === 404 ? 404 : 503, { ok: false, reviewStatus: error?.statusCode === 404 ? 'candidate-not-found' : 'storage-error' });
  }
};
