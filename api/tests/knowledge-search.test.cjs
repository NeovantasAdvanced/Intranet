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
const retrievalIndex = { ...index, chunks: [
  { id: 'cover', text: 'Política de Teletrabajo. Índice e introducción.', position: 0, page: 1 },
  { id: 'conditions', text: 'Condiciones de teletrabajo: la jornada y el horario aplicables se acuerdan con el responsable.', position: 850, page: 3 },
  { id: 'request', text: 'Procedimiento para solicitar teletrabajo mediante la herramienta corporativa.', position: 1700, page: 4 },
  { id: 'expenses', text: 'Gastos y medios: la política establece las condiciones aplicables a los medios de trabajo.', position: 2550, page: 5 },
] };
const documentA = { document: 'originals/politica-teletrabajo.pdf', chunks: [
  { id: 'a1', text: 'Política de teletrabajo y condiciones generales.', position: 0, page: 1 },
  { id: 'a2', text: 'H. Compensación de gastos: se cubren los gastos conforme a estas condiciones.', position: 12675, page: 8 },
  { id: 'a3', text: 'La compensación de gastos se ajustará al convenio colectivo aplicable.', position: 13525, page: 8 },
] };
const documentB = { document: 'originals/guia-nomina.pdf', chunks: [
  { id: 'b1', text: 'La nómina incluye información sobre gastos y compensaciones.', position: 0, page: 1 },
  { id: 'b2', text: 'Los gastos de nómina se reflejan en los procesos administrativos.', position: 900, page: 2 },
] };
const documentC = { document: 'originals/guia-neobuddy.pdf', chunks: [{ id: 'c1', text: 'NeoBuddy explica herramientas y gastos para nuevas personas.', position: 0, page: 1 }] };

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
  const substantive = search.searchIndexes([retrievalIndex], 'teletrabajo', { candidateLimit: 15, maxResults: 5, expandNeighbors: true });
  assert.equal(substantive[0].fragmentId, 'conditions');
  assert.ok(substantive.some((result) => result.fragmentId === 'request'));
  assert.ok(substantive.some((result) => result.fragmentId === 'expenses'));
  const hierarchical = search.searchIndexes([documentA, documentB, documentC], 'gastos teletrabajo', { candidateLimit: 15, maxResults: 5, expandNeighbors: true, diagnostic: true });
  assert.equal(hierarchical.primaryDocument, documentA.document);
  assert.ok(hierarchical.results.some((result) => result.fragmentId === 'a2'));
  assert.ok(hierarchical.results.some((result) => result.fragmentId === 'a3'));
  assert.ok(hierarchical.documents[0].document === documentA.document);
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
