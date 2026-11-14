const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');
const { getKnowledgeConfig, createContainerClient } = require('../_shared/knowledge-blob.cjs');
const { TARGET_DOCUMENT } = require('../_shared/knowledge-pdf.cjs');
const { createDocumentIndex, writeDocumentIndex } = require('../_shared/knowledge-index.cjs');

function send(context, status, body) {
  context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body };
}

module.exports = async function knowledgeIndex(context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!principal) {
    send(context, 401, { ok: false, document: TARGET_DOCUMENT, indexStatus: 'authentication-required' });
    return;
  }
  if (!isAdminPrincipal(principal)) {
    send(context, 403, { ok: false, document: TARGET_DOCUMENT, indexStatus: 'admin-access-required' });
    return;
  }
  if (!getKnowledgeConfig().configured) {
    send(context, 503, { ok: false, document: TARGET_DOCUMENT, indexStatus: 'storage-not-configured' });
    return;
  }

  try {
    const containerClient = createContainerClient();
    const { index, blobName } = await createDocumentIndex({ containerClient });
    await writeDocumentIndex(containerClient, blobName, index);
    send(context, 200, {
      ok: true,
      document: index.document,
      pageCount: index.pageCount,
      extractedCharacters: index.extractedCharacters,
      chunkCount: index.chunkCount,
      indexStatus: 'created',
    });
  } catch (error) {
    const status = error?.code === 'PDF_TOO_LARGE' ? 413 : error?.code === 'PDF_NO_TEXT' ? 422 : error?.statusCode === 404 ? 404 : 503;
    const indexStatus = error?.code === 'PDF_TOO_LARGE' ? 'pdf-too-large' : error?.code === 'PDF_NO_TEXT' ? 'no-extractable-text' : error?.statusCode === 404 ? 'document-not-found' : 'storage-or-processing-error';
    context.log?.(`[knowledge-index] ${indexStatus}`);
    send(context, status, { ok: false, document: TARGET_DOCUMENT, indexStatus });
  }
};
