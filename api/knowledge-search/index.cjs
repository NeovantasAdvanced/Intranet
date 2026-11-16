const { getPrincipalFromRequest } = require('../_shared/auth.cjs');
const { authorizePrincipal } = require('../_shared/hybrid-auth.cjs');
const knowledgeIndex = require('../_shared/knowledge-index.cjs');
const { getStorageErrorDetails } = require('../_shared/knowledge-publish.cjs');
const search = require('../_shared/knowledge-search.cjs');

function send(context, status, body) {
  context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body };
}

module.exports = async function knowledgeSearch(context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!principal) return send(context, 401, { ok: false, searchStatus: 'authentication-required', results: [] });
  if (!(await authorizePrincipal(principal, 'admin')).allowed) return send(context, 403, { ok: false, searchStatus: 'admin-access-required', results: [] });
  const query = typeof req?.query?.q === 'string' ? req.query.q : '';
  if (query.length > search.MAX_QUERY_LENGTH) return send(context, 400, { ok: false, searchStatus: 'query-too-long', results: [] });
  if (!query.trim()) return send(context, 200, { ok: true, query: '', results: [] });
  if (!knowledgeIndex.getIndexReadStorageConfig().configured) return send(context, 503, { ok: false, searchStatus: 'storage-not-configured', results: [] });
  try {
    const client = knowledgeIndex.createIndexReadContainerClient();
    const { indexes } = await search.loadPublishedIndexes(client);
    return send(context, 200, { ok: true, query, results: search.searchIndexes(indexes, query) });
  } catch (error) {
    const searchStatus = error?.code === 'MANIFEST_INVALID' ? 'manifest-invalid' : error?.code === 'SEARCH_INDEX_INVALID' ? 'index-invalid' : error?.code === 'INDEX_TOO_LARGE' ? 'index-too-large' : 'storage-error';
    context.log?.(`[knowledge-search] ${searchStatus === 'storage-error' ? JSON.stringify(getStorageErrorDetails(error, 'read-published-indexes')) : searchStatus}`);
    return send(context, 503, { ok: false, searchStatus, results: [] });
  }
};
