const assert = require('node:assert/strict');
const knowledgeIndex = require('../_shared/knowledge-index.cjs');
const search = require('../_shared/knowledge-search.cjs');
const { getOpenAIConfig, askOpenAI, extractOutputText } = require('../_shared/openai-client.cjs');

const header = () => Buffer.from(JSON.stringify({ userDetails: 'admin@neovantas.com', userRoles: ['admin'], claims: [] })).toString('base64');
const invoke = (handler, body, headers = { 'x-ms-client-principal': header() }) => { const context = { log() {} }; return handler(context, { headers, body }).then(() => context.res); };

async function run() {
  const originals = { config: knowledgeIndex.getIndexReadStorageConfig, client: knowledgeIndex.createIndexReadContainerClient, load: search.loadPublishedIndexes, search: search.searchIndexes, fetch: global.fetch, env: { ...process.env } };
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_MODEL = 'gpt-4.1-mini';
  try {
    const endpoint = require('../knowledge-ask/index.cjs');
    assert.equal(getOpenAIConfig().model, 'gpt-4.1-mini');
    knowledgeIndex.getIndexReadStorageConfig = () => ({ configured: true });
    knowledgeIndex.createIndexReadContainerClient = () => ({});
    search.loadPublishedIndexes = async () => ({ indexes: [] });
    search.searchIndexes = () => [{ document: 'originals/policy.pdf', fragmentId: 'fragment-1', text: 'La politica permite teletrabajo.', position: 0, page: 2, score: 20 }];
    search.loadPublishedIndexes = async () => { throw new Error('out-of-scope must not load documents'); };
    let response = await invoke(endpoint, { question: '¿Me das una receta de cocina?' });
    assert.equal(response.status, 200); assert.equal(response.body.answerStatus, 'out-of-scope');
    global.fetch = async () => ({ ok: true, json: async () => ({ output_text: JSON.stringify({ answer: 'Puedo ayudarte con la cultura, ideas y documentación de Neovantas.', references: [{ document: 'Neovantas · Identidad de Neo', fragmentId: 'neo-identity', page: null }], answerStatus: 'answered', answerType: 'corporate-identity' }) }) });
    response = await invoke(endpoint, { question: '¿Qué puedes hacer por mí?' });
    assert.equal(response.body.answerStatus, 'answered'); assert.equal(response.body.answerType, 'corporate-identity');
    response = await invoke(endpoint, { question: '¿Cuáles son nuestras 5 C?' });
    assert.equal(response.body.answerStatus, 'answered'); assert.equal(response.body.answerType, 'corporate-identity');
    search.loadPublishedIndexes = async () => ({ indexes: [] });
    let captured;
    global.fetch = async (url, options) => { captured = { url, options }; return { ok: true, json: async () => ({ output_text: JSON.stringify({ answer: 'La politica permite teletrabajo.', references: [{ document: 'originals/policy.pdf', fragmentId: 'fragment-1', page: 2 }], answerStatus: 'answered' }), usage: { input_tokens: 100, output_tokens: 30 } }) }; };
    response = await invoke(endpoint, JSON.stringify({ question: 'teletrabajo' }));
    assert.equal(response.status, 200); assert.equal(response.body.answerStatus, 'answered'); assert.equal(response.body.sourceCount, 1);
    const requestBody = JSON.parse(captured.options.body); assert.equal(requestBody.model, 'gpt-4.1-mini'); assert.equal(requestBody.store, false); assert.match(captured.options.headers.authorization, /^Bearer /);
    response = await invoke(endpoint, { question: 'teletrabajo' }); assert.equal(response.status, 200);
    search.searchIndexes = () => []; global.fetch = async () => ({ ok: true, json: async () => ({ output_text: JSON.stringify({ answer: 'Una explicación general.', references: [], answerStatus: 'answered', answerType: 'general-knowledge' }) }) });
    response = await invoke(endpoint, { question: '¿Qué es un nudge?' }); assert.equal(response.body.answerStatus, 'answered'); assert.equal(response.body.answerType, 'general-knowledge');
    search.searchIndexes = () => [];
    response = await invoke(endpoint, { question: '¿Cuál es la política de vacaciones?' }); assert.equal(response.body.answerStatus, 'insufficient-evidence');
    search.searchIndexes = () => [{ document: 'originals/policy.pdf', fragmentId: 'fragment-1', text: 'dato', page: 2 }];
    global.fetch = async () => ({ ok: true, json: async () => ({ output_text: JSON.stringify({ answer: 'inventada', references: [{ document: 'originals/other.pdf', fragmentId: 'fake', page: 1 }], answerStatus: 'answered' }) }) });
    response = await invoke(endpoint, { question: 'teletrabajo' }); assert.equal(response.body.answerStatus, 'insufficient-evidence'); assert.equal(response.body.sourceCount, 0);
    assert.equal((await invoke(endpoint, { question: 'x'.repeat(1001) })).status, 400); assert.equal((await invoke(endpoint, '{invalid')).status, 400); assert.equal((await invoke(endpoint, { question: 'x' }, {})).status, 401);
    const nonAdmin = Buffer.from(JSON.stringify({ userDetails: 'employee@neovantas.com', userRoles: [], claims: [] })).toString('base64');
    assert.equal((await invoke(endpoint, { question: 'x' }, { 'x-ms-client-principal': nonAdmin })).status, 403);
    let fetchOptions; const rateLimitedFetch = async (_url, options) => { fetchOptions = options; return { ok: false, status: 429, json: async () => ({}) }; };
    await assert.rejects(() => askOpenAI({ question: 'q', context: 'contexto', config: getOpenAIConfig(), fetchImpl: rateLimitedFetch }), (error) => error.code === 'RATE_LIMITED'); assert.match(fetchOptions.headers.authorization, /^Bearer /);
    assert.equal(extractOutputText({ output: [{ type: 'reasoning', content: [] }, { type: 'message', content: [{ type: 'output_text', text: 'respuesta' }] }] }), 'respuesta');
    const incompleteFetch = async () => ({ ok: true, json: async () => ({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }) });
    await assert.rejects(() => askOpenAI({ question: 'q', context: '', config: getOpenAIConfig(), fetchImpl: incompleteFetch }), (error) => error.code === 'OPENAI_INCOMPLETE_RESPONSE');
    const emptyFetch = async () => ({ ok: true, json: async () => ({ status: 'completed', output: [] }) });
    await assert.rejects(() => askOpenAI({ question: 'q', context: '', config: getOpenAIConfig(), fetchImpl: emptyFetch }), (error) => error.code === 'OPENAI_INVALID_RESPONSE');
    const malformedFetch = async () => ({ ok: true, json: async () => ({ output_text: '{invalid' }) });
    await assert.rejects(() => askOpenAI({ question: 'q', context: '', config: getOpenAIConfig(), fetchImpl: malformedFetch }), (error) => error.code === 'OPENAI_INVALID_RESPONSE');
    const providerFetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await assert.rejects(() => askOpenAI({ question: 'q', context: '', config: getOpenAIConfig(), fetchImpl: providerFetch }), (error) => error.code === 'UPSTREAM');
  } finally {
    knowledgeIndex.getIndexReadStorageConfig = originals.config; knowledgeIndex.createIndexReadContainerClient = originals.client; search.loadPublishedIndexes = originals.load; search.searchIndexes = originals.search; global.fetch = originals.fetch;
    for (const key of Object.keys(process.env)) if (!(key in originals.env)) delete process.env[key]; for (const [key, value] of Object.entries(originals.env)) process.env[key] = value;
  }
  console.log('knowledge-ask tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
