const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');
const knowledgeBlob = require('../_shared/knowledge-blob.cjs');
const { getKnowledgeConfig, createContainerClient } = knowledgeBlob;
const { TARGET_DOCUMENT } = require('../_shared/knowledge-pdf.cjs');
const knowledgeIndexStorage = require('../_shared/knowledge-index.cjs');
const { getIndexStorageConfig } = knowledgeIndexStorage;

function send(context, status, body) {
  context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body };
}

function getRequestedDocument(req) {
  if (req?.body === undefined || req?.body === null || req.body === '') return TARGET_DOCUMENT;
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
  let body;
  try {
    body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  } catch {
    throw Object.assign(new Error('INVALID_REQUEST'), { code: 'INVALID_REQUEST' });
  }
  if (!body || typeof body !== 'object') throw Object.assign(new Error('INVALID_REQUEST'), { code: 'INVALID_REQUEST' });
  if (typeof body.document !== 'string' || !body.document.trim()) {
    throw Object.assign(new Error('INVALID_REQUEST'), { code: 'INVALID_REQUEST' });
  }
  return body.document.trim();
}

function isSafeDocumentPath(document) {
  return typeof document === 'string' && document.startsWith('originals/') && !document.includes('..');
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
  let requestedDocument = TARGET_DOCUMENT;
  let responseDocument = TARGET_DOCUMENT;
  try {
    requestedDocument = getRequestedDocument(req);
  } catch {
    send(context, 400, { ok: false, document: TARGET_DOCUMENT, indexStatus: 'invalid-request' });
    return;
  }
  if (!getKnowledgeConfig().configured || !getIndexStorageConfig().configured) {
    send(context, 503, { ok: false, document: TARGET_DOCUMENT, indexStatus: 'storage-not-configured' });
    return;
  }

  try {
    const document = requestedDocument;
    responseDocument = isSafeDocumentPath(document) ? document : TARGET_DOCUMENT;
    const sourceContainerClient = createContainerClient();
    const indexContainerClient = knowledgeIndexStorage.createIndexContainerClient();
    if (!isSafeDocumentPath(document)) {
      throw Object.assign(new Error('DOCUMENT_PATH_NOT_ALLOWED'), { code: 'DOCUMENT_PATH_NOT_ALLOWED' });
    }
    const available = await knowledgeBlob.listKnowledgeDocuments({ containerClient: sourceContainerClient });
    if (!available.some((item) => item.name === document)) {
      throw Object.assign(new Error('DOCUMENT_NOT_FOUND'), { code: 'DOCUMENT_NOT_FOUND' });
    }
    const { index, blobName } = await knowledgeIndexStorage.createDocumentIndex({ containerClient: sourceContainerClient, document });
    const writeResult = await knowledgeIndexStorage.writeDocumentIndex(indexContainerClient, blobName, index);
    send(context, 200, {
      ok: true,
      document: index.document,
      pageCount: index.pageCount,
      extractedCharacters: index.extractedCharacters,
      chunkCount: index.chunkCount,
      indexStatus: writeResult.alreadyExists ? 'already-exists' : 'created',
    });
  } catch (error) {
    const status = error?.code === 'DOCUMENT_PATH_NOT_ALLOWED' ? 400 : error?.code === 'DOCUMENT_NOT_FOUND' ? 404 : error?.code === 'PDF_TOO_LARGE' ? 413 : error?.code === 'PDF_NO_TEXT' ? 422 : 503;
    const indexStatus = error?.code === 'DOCUMENT_PATH_NOT_ALLOWED' ? 'document-path-not-allowed' : error?.code === 'DOCUMENT_NOT_FOUND' ? 'document-not-found' : error?.code === 'PDF_TOO_LARGE' ? 'pdf-too-large' : error?.code === 'PDF_NO_TEXT' ? 'no-extractable-text' : 'storage-error';
    context.log?.(`[knowledge-index] ${indexStatus}`);
    send(context, status, { ok: false, document: responseDocument, indexStatus });
  }
};
