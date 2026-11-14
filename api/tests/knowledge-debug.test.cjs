const assert = require('node:assert/strict');
const knowledgeIndex = require('../_shared/knowledge-index.cjs');
const search = require('../_shared/knowledge-search.cjs');
const handler = require('../knowledge-debug/index.cjs');

const admin = Buffer.from(JSON.stringify({ userDetails: 'admin@neovantas.com', userRoles: ['admin'] })).toString('base64');
const fixture = { schemaVersion: '1.0', document: 'originals/politica-teletrabajo.pdf', etag: 'etag', chunks: [
  { id: 'cover', text: 'Política de Teletrabajo. Índice e introducción.', position: 0, page: 1 },
  { id: 'conditions', text: 'Condiciones: la jornada y el horario se acuerdan con el responsable.', position: 850, page: 3 },
  { id: 'expenses', text: 'Gastos y medios: la empresa cubre los equipos indicados en la política.', position: 1700, page: 4 },
] };

(async () => {
  const originals = { config: knowledgeIndex.getIndexReadStorageConfig, client: knowledgeIndex.createIndexReadContainerClient, load: search.loadPublishedIndexes };
  knowledgeIndex.getIndexReadStorageConfig = () => ({ configured: true });
  knowledgeIndex.createIndexReadContainerClient = () => ({});
  search.loadPublishedIndexes = async () => ({ indexes: [fixture] });
  const invoke = async (headers, query) => { const context = { res: null, log() {} }; await handler(context, { headers, query }); return context.res; };
  try {
    assert.equal((await invoke({}, { q: 'gastos' })).status, 401);
    const employee = Buffer.from(JSON.stringify({ userDetails: 'employee@neovantas.com', userRoles: ['authenticated'] })).toString('base64');
    assert.equal((await invoke({ 'x-ms-client-principal': employee }, { q: 'gastos' })).status, 403);
    const response = await invoke({ 'x-ms-client-principal': admin }, { q: 'gastos', document: fixture.document });
    assert.equal(response.status, 200); assert.equal(response.body.totalFragments, 3); assert.equal(response.body.documents[0].document, fixture.document); assert.ok(response.body.candidates.some((item) => item.fragmentId === 'expenses')); assert.ok(response.body.contextCharacters > 0); assert.equal(response.body.contextTruncated, false); assert.equal(response.body.indicators.gastos, true); assert.ok(response.body.candidates.every((item) => item.preview.length <= 300));
    const fragment = await invoke({ 'x-ms-client-principal': admin }, { q: 'gastos', document: fixture.document, fragmentId: 'expenses', includeText: 'true' });
    assert.equal(fragment.status, 200); assert.match(fragment.body.fragment.text, /Gastos/);
    assert.equal((await invoke({ 'x-ms-client-principal': admin }, { q: 'gastos', includeText: 'true' })).status, 400);
    assert.equal((await invoke({ 'x-ms-client-principal': admin }, { q: 'gastos', fragmentId: 'missing', includeText: 'true' })).status, 404);
  } finally { knowledgeIndex.getIndexReadStorageConfig = originals.config; knowledgeIndex.createIndexReadContainerClient = originals.client; search.loadPublishedIndexes = originals.load; }
  console.log('knowledge-debug tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
