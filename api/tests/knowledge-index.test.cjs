const assert = require('node:assert/strict');
const indexer = require('../_shared/knowledge-index.cjs');
const handler = require('../knowledge-index/index.cjs');

function principal(role = 'admin') {
  return Buffer.from(JSON.stringify({ userDetails: 'admin@neovantas.com', userRoles: [role] })).toString('base64');
}

async function invoke(headers = {}) {
  const context = { res: null, log() {} };
  await handler(context, { headers });
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
  await assert.rejects(() => indexer.writeDocumentIndex({ getBlockBlobClient() {} }, 'originals/not-allowed.json', {}), /INDEX_PATH_NOT_ALLOWED/);
  let uploaded;
  const indexClient = { getBlockBlobClient: () => ({ uploadData: async (body, options) => { uploaded = { body, options }; } }) };
  assert.deepEqual(await indexer.writeDocumentIndex(indexClient, indexer.getIndexBlobName(documentIndex), documentIndex), { created: true, alreadyExists: false });
  assert.equal(uploaded.options.overwrite, false);
  const conflictClient = { getBlockBlobClient: () => ({ uploadData: async () => { const error = new Error('exists'); error.statusCode = 409; throw error; } }) };
  assert.deepEqual(await indexer.writeDocumentIndex(conflictClient, indexer.getIndexBlobName(documentIndex), documentIndex), { created: false, alreadyExists: true });
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
  } finally {
    for (const name of ['KNOWLEDGE_STORAGE_ACCOUNT', 'KNOWLEDGE_CONTAINER', 'KNOWLEDGE_BLOB_SAS_TOKEN', 'KNOWLEDGE_INDEX_STORAGE_ACCOUNT', 'KNOWLEDGE_INDEX_CONTAINER', 'KNOWLEDGE_INDEX_BLOB_SAS_TOKEN']) {
      if (old[name] === undefined) delete process.env[name]; else process.env[name] = old[name];
    }
  }
  console.log('knowledge-index tests passed');
})();
