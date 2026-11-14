const assert = require('node:assert/strict');
const search = require('../_shared/knowledge-search.cjs');
const handler = require('../knowledge-search/index.cjs');

const current = 'knowledge-index/current.json';
const currentDocument = 'originals/01/Código Ético.pdf';
const currentIndex = 'knowledge-index/documents/current.json';
const oldIndex = 'knowledge-index/documents/old.json';
const manifest = { schemaVersion: '1.0', publishedAt: '2026-01-01T00:00:00.000Z', documents: { [currentDocument]: { index: currentIndex, etag: 'etag-current', indexedAt: '2026-01-01T00:00:00.000Z' } } };
const index = { schemaVersion: '1.0', document: currentDocument, etag: 'etag-current', pageCount: 2, extractedCharacters: 100, chunks: [
  { id: 'a', text: 'La política de teletrabajo permite trabajo remoto y flexibilidad.', position: 0, page: 1 },
  { id: 'b', text: 'Teletrabajo y flexibilidad.', position: 850, page: null },
  { id: 'old', text: 'Teletrabajo y flexibilidad.', position: 1700, page: null },
] };

function client(objects) {
  return { getBlobClient: (name) => ({ download: async () => {
    if (objects[name] === undefined) { const error = new Error('not found'); error.statusCode = 404; throw error; }
    return { readableStreamBody: [Buffer.from(JSON.stringify(objects[name]))] };
  } }) };
}

(async () => {
  assert.deepEqual(search.tokenize('¿Políticas y TELETRABAJO?'), ['politicas', 'teletrabajo']);
  const results = search.searchIndexes([index], 'POLÍTICA teletrabajo');
  assert.equal(results[0].fragmentId, 'a');
  assert.equal(results[0].page, 1);
  assert.ok(results[0].score > results[1].score);
  assert.equal(search.searchIndexes([index], 'inexistente').length, 0);
  assert.equal(search.searchIndexes([index], '   ').length, 0);
  assert.equal(search.searchIndexes([index], 'teletrabajo').length, 2);
  assert.equal(search.searchIndexes([{ ...index, chunks: [...index.chunks, { ...index.chunks[1], id: 'duplicate' }] }], 'teletrabajo').length, 2);
  assert.equal((await search.loadPublishedIndexes(client({ [current]: manifest, [currentIndex]: index, [oldIndex]: { ...index, etag: 'old' } }))).indexes[0].etag, 'etag-current');
  await assert.rejects(() => search.loadPublishedIndexes(client({ [current]: manifest })), (error) => error.statusCode === 404);
  await assert.rejects(() => search.loadPublishedIndexes(client({ [current]: { bad: true } })), /MANIFEST_INVALID/);
  await assert.rejects(() => search.loadPublishedIndexes(client({ [current]: manifest, [currentIndex]: { ...index, etag: 'wrong' } })), /SEARCH_INDEX_INVALID/);
  assert.equal(search.normalizeSearchText('Árbol,  ÚTIL'), 'arbol util');
  assert.equal(search.MAX_QUERY_LENGTH, 200);

  const invoke = async (headers, query = {}) => { const context = { res: null, log() {} }; await handler(context, { headers, query }); return context.res; };
  assert.equal((await invoke()).status, 401);
  const employee = Buffer.from(JSON.stringify({ userDetails: 'employee@neovantas.com', userRoles: ['authenticated'] })).toString('base64');
  assert.equal((await invoke({ 'x-ms-client-principal': employee }, { q: 'teletrabajo' })).status, 403);
  const old = process.env.KNOWLEDGE_INDEX_READ_SAS_TOKEN;
  delete process.env.KNOWLEDGE_INDEX_READ_SAS_TOKEN;
  assert.equal((await invoke({ 'x-ms-client-principal': Buffer.from(JSON.stringify({ userRoles: ['admin'] })).toString('base64') }, { q: 'teletrabajo' })).status, 503);
  if (old === undefined) delete process.env.KNOWLEDGE_INDEX_READ_SAS_TOKEN; else process.env.KNOWLEDGE_INDEX_READ_SAS_TOKEN = old;
  assert.equal((await invoke({ 'x-ms-client-principal': Buffer.from(JSON.stringify({ userRoles: ['admin'] })).toString('base64') }, { q: 'x'.repeat(201) })).status, 400);
  console.log('knowledge-search tests passed');
})();
