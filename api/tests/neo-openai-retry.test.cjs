const assert = require('node:assert/strict');
const endpoint = require('../knowledge-ask/index.cjs');
const { getOpenAIConfig } = require('../_shared/openai-client.cjs');
const admin = Buffer.from(JSON.stringify({ userDetails: 'admin@neovantas.com', userRoles: ['admin'] })).toString('base64');

(async () => {
  const oldEnv = { ...process.env }; const oldFetch = global.fetch;
  process.env.OPENAI_API_KEY = 'test'; process.env.OPENAI_MODEL = 'gpt-4.1-mini'; delete process.env.OPENAI_MAX_OUTPUT_TOKENS;
  assert.equal(getOpenAIConfig().maxOutputTokens, 3000); process.env.OPENAI_MAX_OUTPUT_TOKENS = 'not-an-integer'; assert.equal(getOpenAIConfig().maxOutputTokens, 3000); process.env.OPENAI_MAX_OUTPUT_TOKENS = '5000'; assert.equal(getOpenAIConfig().maxOutputTokens, 4000);
  let calls = 0; global.fetch = async () => { calls += 1; if (calls === 1) return { ok: true, json: async () => ({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [], usage: { output_tokens: 3000 } }) }; return { ok: true, json: async () => ({ status: 'completed', output_text: JSON.stringify({ answer: 'Respuesta completa.', references: [], answerStatus: 'answered', answerType: 'general-knowledge' }), usage: { output_tokens: 100 } }) }; };
  try { const context = { res: null, logs: [], log(value) { this.logs.push(value); } }; await endpoint(context, { headers: { 'x-ms-client-principal': admin }, body: { question: '¿Qué es un nudge?', messages: [] } }); assert.equal(context.res.status, 200); assert.equal(calls, 2); assert.ok(context.logs.some((entry) => entry.includes('generation-retry')));
    calls = 0; global.fetch = async () => { calls += 1; return { ok: true, json: async () => ({ status: 'incomplete', incomplete_details: { reason: 'content_filter' }, output: [] }) }; }; const filtered = { res: null, log() {} }; await endpoint(filtered, { headers: { 'x-ms-client-principal': admin }, body: { question: '¿Qué es un nudge?', messages: [] } }); assert.equal(filtered.res.status, 502); assert.equal(calls, 1);
  } finally { global.fetch = oldFetch; for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key]; for (const [key, value] of Object.entries(oldEnv)) process.env[key] = value; }
  console.log('neo openai retry tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
