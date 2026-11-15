const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');
const web = require('../_shared/public-knowledge.cjs');

function send(context, status, body) { context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body }; }
function parseBody(body) { if (typeof body === 'string') { try { return JSON.parse(body); } catch { return null; } } return body && typeof body === 'object' ? body : null; }
module.exports = async function knowledgeWebPublish(context, req) {
  const principal = getPrincipalFromRequest(req); if (!principal) return send(context, 401, { ok: false, publishStatus: 'authentication-required' }); if (!isAdminPrincipal(principal)) return send(context, 403, { ok: false, publishStatus: 'admin-access-required' });
  const candidateId = parseBody(req?.body)?.candidateId; if (typeof candidateId !== 'string' || !/^[a-f0-9]{24}$/.test(candidateId)) return send(context, 400, { ok: false, publishStatus: 'candidate-required' });
  const config = web.getConfig(); if (!config.configured) return send(context, 503, { ok: false, publishStatus: 'storage-not-configured' });
  try {
    const readClient = web.createBlobClient(config, config.readSas); const writeClient = web.createBlobClient(config, config.writeSas); const candidate = await web.readBlobJson(readClient, `${web.PUBLIC_PREFIX}candidates/${candidateId}.json`);
    if (!candidate || candidate.schemaVersion !== web.PUBLIC_SCHEMA_VERSION || !Array.isArray(candidate.pages) || !candidate.pages.length || candidate.pages.some((page) => !page.url || !page.title || !Array.isArray(page.chunks) || !page.chunks.length)) return send(context, 422, { ok: false, publishStatus: 'candidate-invalid' });
    const manifest = { schemaVersion: web.PUBLIC_SCHEMA_VERSION, source: 'corporate-web', publishedAt: new Date().toISOString(), candidateId, pages: candidate.pages.map((page) => ({ title: page.title, url: page.url, category: page.category || 'other', language: page.language || 'unknown', indexedAt: page.syncedAt, chunkCount: page.chunks.length, chunks: page.chunks })) };
    const manifestClient = readClient.getBlobClient(web.CURRENT_MANIFEST); let conditions = { ifNoneMatch: '*' }; try { const properties = await manifestClient.getProperties(); conditions = { ifMatch: properties.etag }; } catch (error) { if (error?.statusCode !== 404) throw error; }
    await writeClient.getBlockBlobClient(web.CURRENT_MANIFEST).uploadData(Buffer.from(JSON.stringify(manifest)), { conditions, blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' } });
    return send(context, 200, { ok: true, publishStatus: 'published', candidateId, pageCount: manifest.pages.length, chunkCount: manifest.pages.reduce((sum, page) => sum + page.chunkCount, 0) });
  } catch (error) { const status = error?.statusCode === 409 || error?.statusCode === 412 ? 'publish-conflict' : error?.statusCode === 404 ? 'candidate-not-found' : 'publish-error'; context.log?.(`[knowledge-web-publish] ${status}`); return send(context, status === 'publish-conflict' ? 409 : status === 'candidate-not-found' ? 404 : 503, { ok: false, publishStatus: status }); }
};
