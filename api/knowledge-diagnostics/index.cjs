const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');
const { getKnowledgeConfig, listKnowledgeDocuments } = require('../_shared/knowledge-blob.cjs');

module.exports = async function knowledgeDiagnostics(context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!principal) {
    context.res = { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Authentication required.' }) };
    return;
  }
  if (!isAdminPrincipal(principal)) {
    context.res = { status: 403, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Forbidden.' }) };
    return;
  }

  const config = getKnowledgeConfig();
  const response = { ok: true, configured: config.configured, connection: 'not-tested', documents: [] };
  if (config.configured) {
    try {
      response.documents = await listKnowledgeDocuments();
      response.connection = 'ok';
    } catch {
      context.log.error('[admin/knowledge/diagnostics] Blob connection failed.');
      response.connection = 'error';
      response.error = 'Unable to list knowledge documents.';
    }
  }
  response.documents = response.documents.map((document) => document.name);
  context.res = {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(response),
  };
};
