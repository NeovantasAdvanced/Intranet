const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');
const knowledgeBlob = require('../_shared/knowledge-blob.cjs');
const knowledgeIndex = require('../_shared/knowledge-index.cjs');
const { buildCurrentManifest, publishCurrentManifest } = require('../_shared/knowledge-publish.cjs');

function send(context, status, body) {
  context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body };
}

module.exports = async function knowledgePublish(context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!principal) return send(context, 401, { ok: false, publishStatus: 'authentication-required' });
  if (!isAdminPrincipal(principal)) return send(context, 403, { ok: false, publishStatus: 'admin-access-required' });
  if (!knowledgeBlob.getKnowledgeConfig().configured || !knowledgeIndex.getIndexStorageConfig().configured || !knowledgeIndex.getIndexReadStorageConfig().configured) {
    return send(context, 503, { ok: false, publishStatus: 'storage-not-configured' });
  }
  try {
    const source = knowledgeBlob.createContainerClient();
    const readIndex = knowledgeIndex.createIndexReadContainerClient();
    const writeIndex = knowledgeIndex.createIndexContainerClient();
    const documents = await knowledgeBlob.listKnowledgeDocumentsWithEtags({ containerClient: source });
    const manifest = await buildCurrentManifest({ documents, indexContainerClient: readIndex });
    const result = await publishCurrentManifest(writeIndex, manifest);
    send(context, 200, { ok: true, publishStatus: result.updated ? 'updated' : 'created', documentCount: Object.keys(manifest.documents).length, publishedAt: manifest.publishedAt });
  } catch (error) {
    const status = error?.code === 'INDEX_INCOMPLETE' ? 409 : error?.code === 'MANIFEST_CONFLICT' ? 409 : 503;
    const publishStatus = error?.code === 'INDEX_INCOMPLETE' ? 'incomplete' : error?.code === 'MANIFEST_CONFLICT' ? 'concurrent-conflict' : 'storage-error';
    context.log?.(`[knowledge-publish] ${publishStatus}`);
    send(context, status, { ok: false, publishStatus, pending: error?.code === 'INDEX_INCOMPLETE' ? error.pending : undefined });
  }
};
