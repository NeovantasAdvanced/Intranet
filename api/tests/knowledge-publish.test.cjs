const assert = require('node:assert/strict');
const { getIndexBlobName } = require('../_shared/knowledge-index.cjs');
const { buildCurrentManifest, publishCurrentManifest, validateIndex, getStorageErrorDetails } = require('../_shared/knowledge-publish.cjs');
const handler = require('../knowledge-publish/index.cjs');

const docs = [
  { name: 'originals/01/Código Ético.pdf', etag: 'etag-1' },
  { name: 'originals/02/Teletrabajo.pdf', etag: 'etag-2' },
];

function indexFor(document, etag) {
  return { schemaVersion: '1.0', document, etag, pageCount: 1, extractedCharacters: 10, chunks: [{ id: 'chunk', text: 'contenido', position: 0, page: null }], indexedAt: '2026-01-01T00:00:00.000Z' };
}

function readClient(indexes) {
  return { getBlobClient: (name) => ({ download: async () => {
    if (indexes[name] === undefined) { const error = new Error('not found'); error.statusCode = 404; throw error; }
    return { readableStreamBody: [Buffer.from(JSON.stringify(indexes[name]))] };
  } }) };
}

(async () => {
  const invoke = async (headers = {}) => { const context = { res: null, log() {} }; await handler(context, { headers }); return context.res; };
  assert.equal((await invoke()).status, 401);
  const employee = Buffer.from(JSON.stringify({ userDetails: 'employee@neovantas.com', userRoles: ['authenticated'] })).toString('base64');
  assert.equal((await invoke({ 'x-ms-client-principal': employee })).status, 403);

  const indexes = Object.fromEntries(docs.map((doc) => [getIndexBlobName({ document: doc.name, etag: doc.etag }), indexFor(doc.name, doc.etag)]));
  const manifest = await buildCurrentManifest({ documents: docs, indexContainerClient: readClient(indexes) });
  assert.equal(Object.keys(manifest.documents).length, 2);
  assert.equal(manifest.documents[docs[0].name].etag, 'etag-1');
  assert.equal(validateIndex(indexes[getIndexBlobName({ document: docs[0].name, etag: docs[0].etag })], docs[0].name, docs[0].etag), true);

  await assert.rejects(() => buildCurrentManifest({ documents: docs, indexContainerClient: readClient({ [getIndexBlobName({ document: docs[0].name, etag: docs[0].etag })]: indexes[getIndexBlobName({ document: docs[0].name, etag: docs[0].etag })] }) }), (error) => error.code === 'INDEX_INCOMPLETE' && error.pending[0].reason === 'index-not-found');
  const corrupt = Object.fromEntries(Object.entries(indexes).map(([name, value]) => [name, Buffer.from(JSON.stringify(value))]));
  corrupt[getIndexBlobName({ document: docs[1].name, etag: docs[1].etag })] = Buffer.from('{bad');
  const corruptClient = { getBlobClient: (name) => ({ download: async () => ({ readableStreamBody: [corrupt[name]] }) }) };
  await assert.rejects(() => buildCurrentManifest({ documents: docs, indexContainerClient: corruptClient }), (error) => error.code === 'INDEX_INCOMPLETE');
  await assert.rejects(() => buildCurrentManifest({ documents: docs.map((doc) => ({ ...doc, etag: 'new-etag' })), indexContainerClient: readClient(indexes) }), (error) => error.code === 'INDEX_INCOMPLETE' && error.pending.length === 2);

  let uploadOptions;
  const blob = { uploadData: async (body, options) => { uploadOptions = options; } };
  const client = { getBlockBlobClient: () => blob };
  const readClientForManifest = { getBlobClient: () => ({ getProperties: async () => ({ etag: 'current-etag' }) }) };
  assert.deepEqual(await publishCurrentManifest({ readContainerClient: readClientForManifest, writeContainerClient: client, manifest }), { created: true, updated: false });
  assert.equal(uploadOptions.conditions.ifNoneMatch, '*');
  let calls = 0;
  const existing = { uploadData: async (body, options) => { calls += 1; if (calls === 1) { const error = new Error('exists'); error.statusCode = 412; throw error; } assert.equal(options.conditions.ifMatch, 'current-etag'); }, getProperties: async () => ({ etag: 'current-etag' }) };
  let readPropertiesCalls = 0;
  const readExisting = { getBlobClient: () => ({ getProperties: async () => { readPropertiesCalls += 1; return { etag: 'current-etag' }; } }) };
  assert.deepEqual(await publishCurrentManifest({ readContainerClient: readExisting, writeContainerClient: { getBlockBlobClient: () => existing }, manifest }), { created: false, updated: true });
  assert.equal(readPropertiesCalls, 1);
  const race = { uploadData: async () => { const error = new Error('race'); error.statusCode = 412; throw error; }, getProperties: async () => ({ etag: 'current-etag' }) };
  await assert.rejects(() => publishCurrentManifest({ readContainerClient: readExisting, writeContainerClient: { getBlockBlobClient: () => race }, manifest }), /MANIFEST_CONFLICT/);
  const forbidden = { uploadData: async () => { const error = new Error('forbidden'); error.statusCode = 403; throw error; } };
  await assert.rejects(() => publishCurrentManifest({ readContainerClient: readExisting, writeContainerClient: { getBlockBlobClient: () => forbidden }, manifest }), (error) => error.statusCode === 403);
  assert.deepEqual(getStorageErrorDetails({ statusCode: 403, code: 'AuthorizationPermissionMismatch', details: { errorCode: 'AuthorizationPermissionMismatch', requestId: 'request-id' }, message: 'contains secret URL' }, 'publish-current-manifest'), {
    operation: 'publish-current-manifest',
    statusCode: 403,
    code: 'AuthorizationPermissionMismatch',
    errorCode: 'AuthorizationPermissionMismatch',
    requestId: 'request-id',
  });
  console.log('knowledge-publish tests passed');
})();
