const { getPrincipalFromRequest } = require('../_shared/auth.cjs');
const { authorizePrincipal } = require('../_shared/hybrid-auth.cjs');
const knowledgeBlob = require('../_shared/knowledge-blob.cjs');
const knowledgeIndex = require('../_shared/knowledge-index.cjs');
const { buildCurrentManifest, publishCurrentManifest, getStorageErrorDetails } = require('../_shared/knowledge-publish.cjs');

function send(context, status, body) {
  context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body };
}

module.exports = async function knowledgePublish(context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!principal) return send(context, 401, { ok: false, publishStatus: 'authentication-required' });
  if (!(await authorizePrincipal(principal, 'admin')).allowed) return send(context, 403, { ok: false, publishStatus: 'admin-access-required' });
  if (!knowledgeBlob.getKnowledgeConfig().configured || !knowledgeIndex.getIndexStorageConfig().configured || !knowledgeIndex.getIndexReadStorageConfig().configured) {
    return send(context, 503, { ok: false, publishStatus: 'storage-not-configured' });
  }
  let operation = 'initialization';
  try {
    const source = knowledgeBlob.createContainerClient();
    const readIndex = knowledgeIndex.createIndexReadContainerClient();
    const writeIndex = knowledgeIndex.createIndexContainerClient();
    operation = 'list-source-documents-and-etags';
    const documents = await knowledgeBlob.listKnowledgeDocumentsWithEtags({ containerClient: source });
    operation = 'read-and-validate-indexes';
    const manifest = await buildCurrentManifest({ documents, indexContainerClient: readIndex });
    operation = 'publish-current-manifest';
    const result = await publishCurrentManifest({ readContainerClient: readIndex, writeContainerClient: writeIndex, manifest });
    send(context, 200, { ok: true, publishStatus: result.updated ? 'updated' : 'created', documentCount: Object.keys(manifest.documents).length, publishedAt: manifest.publishedAt });
  } catch (error) {
    const status = error?.code === 'INDEX_INCOMPLETE' ? 409 : error?.code === 'MANIFEST_CONFLICT' ? 409 : 503;
    const publishStatus = error?.code === 'INDEX_INCOMPLETE' ? 'incomplete' : error?.code === 'MANIFEST_CONFLICT' ? 'concurrent-conflict' : 'storage-error';
    if (publishStatus === 'storage-error') context.log?.(`[knowledge-publish] ${JSON.stringify(getStorageErrorDetails(error, operation))}`);
    else context.log?.(`[knowledge-publish] ${publishStatus}`);
    send(context, status, { ok: false, publishStatus, pending: error?.code === 'INDEX_INCOMPLETE' ? error.pending : undefined });
  }
};
