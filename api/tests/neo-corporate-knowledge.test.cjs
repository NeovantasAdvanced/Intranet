const assert = require('node:assert/strict');
const knowledgeIndex = require('../_shared/knowledge-index.cjs');
const search = require('../_shared/knowledge-search.cjs');
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'fixture';
process.env.OPENAI_MODEL = 'gpt-4.1-mini';
const endpoint = require('../knowledge-ask/index.cjs');

const docs = [
  ['01_identidad_y_propuesta_valor.pdf', 'Neovantas combina conocimiento del comportamiento humano y análisis de datos.'],
  ['02_economia_conductual.pdf', 'La economía conductual estudia cómo deciden las personas.'],
  ['03_analitica_conversacional.pdf', 'La analítica conversacional analiza llamadas y textos.'],
  ['04_participantes_sinteticos.pdf', 'Los participantes sintéticos son perfiles simulados con IA, no proyectos reales.'],
  ['05_ia_aplicada_y_soluciones.pdf', 'La IA aplicada puede apoyar clasificación y asistentes con recuperación aumentada.'],
  ['06_casos_uso_banca_seguros_telco.pdf', 'Estos casos de uso en banca, seguros y telco son ejemplos conceptuales, no resultados acreditados.'],
];
const manifest = { schemaVersion: '1.0', publishedAt: '2026-11-17T00:00:00.000Z', documents: Object.fromEntries(docs.map(([name]) => { const document = `originals/neo-knowledge/${name}`; return [document, { index: `knowledge-index/documents/${name}.json`, etag: 'fixture', indexedAt: '2026-11-17T00:00:00.000Z' }]; })) };
const indexes = Object.fromEntries(docs.map(([name, text]) => { const document = `originals/neo-knowledge/${name}`; return [`knowledge-index/documents/${name}.json`, { schemaVersion: '1.0', document, etag: 'fixture', pageCount: 1, extractedCharacters: text.length, chunks: [{ id: `chunk-${name.slice(0, 2)}`, text, position: 0, page: 1 }] }]; }));
for (const [name, text] of docs) assert.ok(search.searchIndexes(Object.values(indexes), text.split(' ').slice(0, 3).join(' '), { maxResults: 1 }).length > 0, `fixture not searchable: ${name}`);
function fakeClient() { return { getBlobClient: (name) => ({ download: async () => { const value = name === 'knowledge-index/current.json' ? manifest : indexes[name]; if (!value) throw Object.assign(new Error('not found'), { statusCode: 404 }); return { readableStreamBody: [Buffer.from(JSON.stringify(value))] }; } }) }; }
function header() { return Buffer.from(JSON.stringify({ identityProvider: 'aad', userId: 'fixture-admin', userDetails: 'admin@neovantas.com', userRoles: ['admin'] })).toString('base64'); }
async function ask(question) {
  const context = { res: null, log() {} };
  global.fetch = async (_url, options) => {
    const input = JSON.parse(options.body).input[0].content[0].text;
    const match = input.match(/\[fragmentId=([^\]]+)\] \[document=([^\]]+)\]/);
    const answer = input.includes('analítica conversacional') ? docs[2][1] : input.includes('participantes sintéticos') ? docs[3][1] : input.includes('economía conductual') ? docs[1][1] : docs[5][1];
    return { ok: true, json: async () => ({ status: 'completed', output_text: JSON.stringify({ answer, references: match ? [{ document: match[2], fragmentId: match[1], page: 1 }] : [], answerStatus: 'answered', answerType: 'internal-document' }) }) };
  };
  await endpoint(context, { headers: { 'x-ms-client-principal': header() }, body: { question, messages: [] } });
  return context.res;
}
(async () => {
  const original = { client: knowledgeIndex.createIndexReadContainerClient, env: { ...process.env } };
  Object.assign(process.env, { KNOWLEDGE_INDEX_STORAGE_ACCOUNT: 'fixture', KNOWLEDGE_INDEX_CONTAINER: 'fixture', KNOWLEDGE_INDEX_READ_SAS_TOKEN: 'fixture', CORPORATE_ALLOWED_USER_IDS: 'fixture-admin' });
  knowledgeIndex.createIndexReadContainerClient = fakeClient;
  try {
    for (const [question, expected] of [['¿Qué es la analítica conversacional?', 'analítica'], ['¿Qué son los participantes sintéticos?', 'sintéticos'], ['¿Cómo aplica Neovantas la economía conductual?', 'economía'], ['¿Qué casos conceptuales existen en banca, seguros y telco?', 'conceptuales']]) {
      const response = await ask(question);
      assert.equal(response.status, 200, JSON.stringify(response));
      assert.equal(response.body.answerStatus, 'answered');
      assert.ok(Array.isArray(response.body.references));
      assert.match(response.body.answer, new RegExp(expected, 'i'));
    }
  } finally {
    knowledgeIndex.createIndexReadContainerClient = original.client;
    for (const key of Object.keys(process.env)) if (!(key in original.env)) delete process.env[key];
    Object.assign(process.env, original.env);
  }
  console.log('neo corporate knowledge tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
