const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ask = require('../knowledge-ask/index.cjs');

const admin = Buffer.from(JSON.stringify({ userDetails: 'admin@neovantas.com', userRoles: ['admin'] })).toString('base64');
(async () => {
  const long = 'respuesta extensa '.repeat(400);
  const normalized = ask.validateHistory([{ role: 'user', content: 'Pregunta inicial' }, { role: 'assistant', content: long }]);
  assert.ok(normalized); assert.ok(normalized[1].content.length <= 2000); assert.match(normalized[1].content, /historial truncado/);
  assert.ok(ask.validateHistory([{ role: 'assistant', content: 'uno' }, { role: 'user', content: 'dos' }, { role: 'assistant', content: long }]).length > 0);
  assert.equal(ask.validateHistory([{ role: 'system', content: 'no permitido' }]), null);
  assert.equal(ask.validateHistory([{ role: 'user', content: 42 }]), null);
  const result = ask.validateModelAnswer({ answer: 'La información indica presencia internacional, pero no enumera países concretos.', references: [{ document: 'https://www.neovantas.com/quienes-somos', fragmentId: 'presence' }], answerStatus: 'insufficient-evidence', answerType: 'corporate-web' }, [{ document: 'https://www.neovantas.com/quienes-somos', fragmentId: 'presence', text: 'presencia internacional', sourceType: 'corporate-web', url: 'https://www.neovantas.com/quienes-somos' }], 'corporate-web');
  assert.equal(result.answerStatus, 'insufficient-evidence'); assert.match(result.answer, /no enumera pa[ií]ses/); assert.equal(result.sourceCount, 1);
  const neoChat = fs.readFileSync(path.join(__dirname, '../../src/components/neo/NeoChat.tsx'), 'utf8'); assert.match(neoChat, /message\.response\?\.answer/); assert.doesNotMatch(neoChat, /response\.answer\.slice/);
  const oldFetch = global.fetch; const oldKey = process.env.OPENAI_API_KEY; const oldModel = process.env.OPENAI_MODEL; process.env.OPENAI_API_KEY = 'test'; process.env.OPENAI_MODEL = 'gpt-4.1-mini';
  global.fetch = async () => ({ ok: true, json: async () => ({ status: 'completed', output_text: JSON.stringify({ answer: 'Seguimos con la conversación.', references: [], answerStatus: 'answered', answerType: 'general-knowledge' }) }) });
  try { const context = { res: null, log() {} }; await require('../knowledge-ask/index.cjs')(context, { headers: { 'x-ms-client-principal': admin }, body: { question: '¿Cómo lo aplicarías?', messages: [{ role: 'user', content: 'Contexto previo' }, { role: 'assistant', content: long }] } }); assert.equal(context.res.status, 200); } finally { global.fetch = oldFetch; if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; if (oldModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = oldModel; }
  console.log('neo history evidence tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
