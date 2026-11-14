const assert = require('node:assert/strict');
const indexer = require('../_shared/knowledge-index.cjs');
const knowledgeBlob = require('../_shared/knowledge-blob.cjs');
const handler = require('../knowledge-index/index.cjs');

function principal(role = 'admin') {
  return Buffer.from(JSON.stringify({ userDetails: 'admin@neovantas.com', userRoles: [role] })).toString('base64');
}

async function invoke(headers = {}, body) {
  const context = { res: null, log() {} };
  await handler(context, { headers, body });
  return context.res;
}

(async () => {
  assert.equal(indexer.normalizeText('  Uno  \r\n\r\n\r\n Dos\t tres '), 'Uno\n\nDos tres');
  const chunks = indexer.splitText('palabra '.repeat(300));
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.text.length <= indexer.CHUNK_SIZE));
  assert.deepEqual(indexer.splitText('texto'), indexer.splitText('texto'));

  const source = '  Política de teletrabajo.\n\n\n Jornada flexible.  ';
  const documentIndex = indexer.buildDocumentIndex({ text: source, pageCount: 2, etag: 'etag-1', indexedAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(documentIndex.schemaVersion, '1.0');
  assert.equal(documentIndex.extractedCharacters, 43);
  assert.equal(documentIndex.chunkCount, 1);
  assert.equal(documentIndex.chunks[0].page, null);
  assert.equal(documentIndex.chunks[0].id, indexer.buildDocumentIndex({ text: source, pageCount: 2, etag: 'etag-1', indexedAt: 'other' }).chunks[0].id);
  assert.match(indexer.getIndexBlobName(documentIndex), /^knowledge-index\/documents\//);
  assert.equal(indexer.getIndexStorageConfig({ KNOWLEDGE_INDEX_STORAGE_ACCOUNT: 'neovantasintranet', KNOWLEDGE_INDEX_CONTAINER: 'neovantas-knowledge-index', KNOWLEDGE_INDEX_BLOB_SAS_TOKEN: 'sv=test' }).configured, true);
  assert.equal(indexer.getIndexStorageConfig({ KNOWLEDGE_STORAGE_ACCOUNT: 'account', KNOWLEDGE_CONTAINER: 'originals', KNOWLEDGE_BLOB_SAS_TOKEN: 'read-only' }).configured, false);
  assert.notEqual(indexer.getIndexBlobName({ document: 'originals/02_personas/Guía de Nómina.pdf', etag: 'etag-1' }), indexer.getIndexBlobName({ document: 'originals/03_trabajo/Política de Teletrabajo.pdf', etag: 'etag-1' }));
  await assert.rejects(() => indexer.downloadTargetPdf({ getBlobClient() {} }, 'https://example.com/file.pdf'), /DOCUMENT_PATH_NOT_ALLOWED/);
  await assert.rejects(() => indexer.writeDocumentIndex({ getBlockBlobClient() {} }, 'originals/not-allowed.json', {}), /INDEX_PATH_NOT_ALLOWED/);
  let uploaded;
  const indexClient = { getBlockBlobClient: () => ({ uploadData: async (body, options) => { uploaded = { body, options }; } }) };
  assert.deepEqual(await indexer.writeDocumentIndex(indexClient, indexer.getIndexBlobName(documentIndex), documentIndex), { created: true, alreadyExists: false });
  assert.equal(uploaded.options.conditions.ifNoneMatch, '*');
  assert.equal(uploaded.options.blobHTTPHeaders.blobContentType, 'application/json; charset=utf-8');
  const conflictClient = { getBlockBlobClient: () => ({ uploadData: async () => { const error = new Error('exists'); error.statusCode = 412; error.details = { errorCode: 'ConditionNotMet' }; throw error; } }) };
  assert.deepEqual(await indexer.writeDocumentIndex(conflictClient, indexer.getIndexBlobName(documentIndex), documentIndex), { created: false, alreadyExists: true });
  const legacyConflictClient = { getBlockBlobClient: () => ({ uploadData: async () => { const error = new Error('exists'); error.code = 'BlobAlreadyExists'; error.statusCode = 409; throw error; } }) };
  assert.deepEqual(await indexer.writeDocumentIndex(legacyConflictClient, indexer.getIndexBlobName(documentIndex), documentIndex), { created: false, alreadyExists: true });
  const unrelatedConflictClient = { getBlockBlobClient: () => ({ uploadData: async () => { const error = new Error('conflict'); error.statusCode = 409; error.details = { errorCode: 'LeaseIdMissing' }; throw error; } }) };
  await assert.rejects(() => indexer.writeDocumentIndex(unrelatedConflictClient, indexer.getIndexBlobName(documentIndex), documentIndex), (error) => error.statusCode === 409);
  const unrelatedConditionClient = { getBlockBlobClient: () => ({ uploadData: async () => { const error = new Error('precondition'); error.statusCode = 412; error.details = { errorCode: 'LeaseIdMissing' }; throw error; } }) };
  await assert.rejects(() => indexer.writeDocumentIndex(unrelatedConditionClient, indexer.getIndexBlobName(documentIndex), documentIndex), (error) => error.statusCode === 412);
  const failureClient = { getBlockBlobClient: () => ({ uploadData: async () => { const error = new Error('forbidden'); error.statusCode = 403; throw error; } }) };
  await assert.rejects(() => indexer.writeDocumentIndex(failureClient, indexer.getIndexBlobName(documentIndex), documentIndex), (error) => error.statusCode === 403);
  await assert.rejects(() => indexer.downloadTargetPdf({ getBlobClient: () => ({ download: async () => ({ contentLength: indexer.MAX_PDF_BYTES + 1 }) }) }), /PDF_TOO_LARGE/);

  assert.equal((await invoke()).status, 401);
  assert.equal((await invoke({ 'x-ms-client-principal': principal('authenticated') })).status, 403);
  const old = { ...process.env };
  delete process.env.KNOWLEDGE_STORAGE_ACCOUNT;
  delete process.env.KNOWLEDGE_CONTAINER;
  delete process.env.KNOWLEDGE_BLOB_SAS_TOKEN;
  delete process.env.KNOWLEDGE_INDEX_STORAGE_ACCOUNT;
  delete process.env.KNOWLEDGE_INDEX_CONTAINER;
  delete process.env.KNOWLEDGE_INDEX_BLOB_SAS_TOKEN;
  try {
    const missing = await invoke({ 'x-ms-client-principal': principal() });
    assert.equal(missing.status, 503);
    assert.equal(missing.body.indexStatus, 'storage-not-configured');
    process.env.KNOWLEDGE_STORAGE_ACCOUNT = 'source-account';
    process.env.KNOWLEDGE_CONTAINER = 'source-container';
    process.env.KNOWLEDGE_BLOB_SAS_TOKEN = 'read-only-test';
    process.env.KNOWLEDGE_INDEX_STORAGE_ACCOUNT = 'index-account';
    process.env.KNOWLEDGE_INDEX_CONTAINER = 'index-container';
    process.env.KNOWLEDGE_INDEX_BLOB_SAS_TOKEN = 'write-only-test';
    const originalList = knowledgeBlob.listKnowledgeDocuments;
    const originalCreateIndex = indexer.createDocumentIndex;
    const originalWrite = indexer.writeDocumentIndex;
    const originalIndexClient = indexer.createIndexContainerClient;
    knowledgeBlob.listKnowledgeDocuments = async () => [
      { name: 'originals/01_cultura_y_cumplimiento/Código Ético y de Conducta - NEOVANTAS.pdf' },
      { name: 'originals/02_personas/Guía de Nómina.pdf' },
    ];
    indexer.createIndexContainerClient = () => ({});
    indexer.createDocumentIndex = async ({ document }) => ({ index: { document, pageCount: 1, extractedCharacters: 4, chunkCount: 1 }, blobName: 'knowledge-index/documents/test.json' });
    indexer.writeDocumentIndex = async () => ({ created: true, alreadyExists: false });
    const valid = await invoke({ 'x-ms-client-principal': principal() }, '{"document":"originals/02_personas/Guía de Nómina.pdf"}');
    assert.equal(valid.status, 200);
    assert.equal(valid.body.document, 'originals/02_personas/Guía de Nómina.pdf');
    assert.equal((await invoke({ 'x-ms-client-principal': principal() }, '{"document":"originals/no-existe.pdf"}')).body.indexStatus, 'document-not-found');
    assert.equal((await invoke({ 'x-ms-client-principal': principal() }, '{"document":"https://example.com/file.pdf"}')).body.indexStatus, 'document-path-not-allowed');
    const compatibility = await invoke({ 'x-ms-client-principal': principal() });
    assert.equal(compatibility.status, 200);
    assert.equal(compatibility.body.document, 'originals/01_cultura_y_cumplimiento/Código Ético y de Conducta - NEOVANTAS.pdf');
    indexer.createIndexContainerClient = originalIndexClient;
    indexer.createDocumentIndex = originalCreateIndex;
    indexer.writeDocumentIndex = originalWrite;
    knowledgeBlob.listKnowledgeDocuments = originalList;
  } finally {
    for (const name of ['KNOWLEDGE_STORAGE_ACCOUNT', 'KNOWLEDGE_CONTAINER', 'KNOWLEDGE_BLOB_SAS_TOKEN', 'KNOWLEDGE_INDEX_STORAGE_ACCOUNT', 'KNOWLEDGE_INDEX_CONTAINER', 'KNOWLEDGE_INDEX_BLOB_SAS_TOKEN']) {
      if (old[name] === undefined) delete process.env[name]; else process.env[name] = old[name];
    }
  }
  console.log('knowledge-index tests passed');
})();
