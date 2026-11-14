const assert = require('node:assert/strict');
const knowledgeIndex = require('../_shared/knowledge-index.cjs');
const endpoint = require('../knowledge-ask/index.cjs');

const document = 'originals/politica-teletrabajo.pdf';
const indexBlob = 'knowledge-index/documents/teletrabajo.json';
const manifest = { schemaVersion: '1.0', publishedAt: '2026-01-01T00:00:00.000Z', documents: { [document]: { index: indexBlob, etag: 'etag-1', indexedAt: '2026-01-01T00:00:00.000Z' } } };
const index = { schemaVersion: '1.0', document, etag: 'etag-1', pageCount: 2, extractedCharacters: 200, chunks: [
  { id: 'cover', text: 'Política de teletrabajo e introducción.', position: 0, page: 1 },
  { id: 'conditions', text: 'Condiciones de teletrabajo: la jornada y el horario se acuerdan con el responsable.', position: 12675, page: 3 },
  { id: 'continuation', text: 'La compensación de gastos se ajustará al convenio colectivo aplicable.', position: 13525, page: 3 },
] };
const adminHeader = Buffer.from(JSON.stringify({ userDetails: 'admin@neovantas.com', userRoles: ['admin'] })).toString('base64');

function fakeClient(objects, failure) {
  return { getBlobClient: (name) => ({ download: async () => { if (failure) throw failure; if (!(name in objects)) { const error = new Error('not found'); error.statusCode = 404; throw error; } return { readableStreamBody: [Buffer.from(JSON.stringify(objects[name]))] }; } }) };
}
async function invoke(body, fetchResponse) {
  global.fetch = async () => fetchResponse;
  const context = { res: null, logEntries: [], log(value) { this.logEntries.push(value); } };
  await endpoint(context, { headers: { 'x-ms-client-principal': adminHeader }, body });
  return context;
}

(async () => {
  const originals = { account: process.env.KNOWLEDGE_INDEX_STORAGE_ACCOUNT, container: process.env.KNOWLEDGE_INDEX_CONTAINER, sas: process.env.KNOWLEDGE_INDEX_READ_SAS_TOKEN, client: knowledgeIndex.createIndexReadContainerClient, fetch: global.fetch };
  process.env.KNOWLEDGE_INDEX_STORAGE_ACCOUNT = 'test-account'; process.env.KNOWLEDGE_INDEX_CONTAINER = 'test-container'; process.env.KNOWLEDGE_INDEX_READ_SAS_TOKEN = 'test-sas'; process.env.OPENAI_API_KEY = 'test-key'; process.env.OPENAI_MODEL = 'gpt-4.1-mini';
  try {
    knowledgeIndex.createIndexReadContainerClient = () => fakeClient({ [ 'knowledge-index/current.json' ]: manifest, [indexBlob]: index });
    const valid = await invoke({ question: '¿Cuáles son las condiciones de teletrabajo?', messages: [] }, { ok: true, json: async () => ({ status: 'completed', output_text: JSON.stringify({ answer: 'La jornada y el horario se acuerdan con el responsable; los gastos se ajustan al convenio colectivo.', references: [{ document, fragmentId: 'conditions', page: 3 }, { document, fragmentId: 'continuation', page: 3 }], answerStatus: 'answered', answerType: 'internal-document' }), usage: {} }) });
    assert.equal(valid.res.status, 200); assert.equal(valid.res.body.answerStatus, 'answered'); assert.equal(valid.res.body.sourceCount, 2); assert.ok(valid.logEntries.some((entry) => entry.includes('"phase":"completed"'))); assert.ok(!valid.logEntries.some((entry) => entry.includes('conditions')));
    const incomplete = await invoke({ question: '¿Cuáles son las condiciones de teletrabajo?', messages: [] }, { ok: true, json: async () => ({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }) });
    assert.equal(incomplete.res.status, 502); assert.equal(incomplete.res.body.answerStatus, 'openai-incomplete-response'); assert.ok(incomplete.logEntries.some((entry) => entry.includes('OPENAI_INCOMPLETE_RESPONSE')));
    const invalidRefs = await invoke({ question: '¿Cuáles son las condiciones de teletrabajo?', messages: [] }, { ok: true, json: async () => ({ status: 'completed', output_text: JSON.stringify({ answer: 'respuesta', references: [{ document: 'originals/otro.pdf', fragmentId: 'fake', page: 1 }], answerStatus: 'answered', answerType: 'internal-document' }) }) });
    assert.equal(invalidRefs.res.status, 200); assert.equal(invalidRefs.res.body.answerStatus, 'insufficient-evidence'); assert.equal(invalidRefs.res.body.sourceCount, 0); assert.ok(invalidRefs.logEntries.some((entry) => entry.includes('"validation":"insufficient-evidence"')));
    const storageError = new Error('storage'); storageError.statusCode = 403; storageError.code = 'AuthorizationPermissionMismatch';
    knowledgeIndex.createIndexReadContainerClient = () => fakeClient({}, storageError);
    const failedStorage = await invoke({ question: '¿Cuáles son las condiciones de teletrabajo?', messages: [] }, { ok: true, json: async () => ({}) });
    assert.equal(failedStorage.res.status, 503); assert.equal(failedStorage.res.body.answerStatus, 'storage-error'); assert.ok(failedStorage.logEntries.some((entry) => entry.includes('"phase":"retrieval"')));
    knowledgeIndex.createIndexReadContainerClient = () => fakeClient({ 'knowledge-index/current.json': { bad: true } });
    const badManifest = await invoke({ question: '¿Cuáles son las condiciones de teletrabajo?', messages: [] }, { ok: true, json: async () => ({}) });
    assert.equal(badManifest.res.status, 502); assert.equal(badManifest.res.body.answerStatus, 'manifest-invalid');
  } finally {
    knowledgeIndex.createIndexReadContainerClient = originals.client; global.fetch = originals.fetch;
    for (const [key, value] of [['KNOWLEDGE_INDEX_STORAGE_ACCOUNT', originals.account], ['KNOWLEDGE_INDEX_CONTAINER', originals.container], ['KNOWLEDGE_INDEX_READ_SAS_TOKEN', originals.sas]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    delete process.env.OPENAI_API_KEY; delete process.env.OPENAI_MODEL;
  }
  console.log('knowledge-ask integration tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
