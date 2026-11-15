const assert = require('node:assert/strict');
const endpoint = require('../knowledge-ask/index.cjs');
const publicKnowledge = require('../_shared/public-knowledge.cjs');
const knowledgeIndex = require('../_shared/knowledge-index.cjs');

const admin = Buffer.from(JSON.stringify({ userDetails: 'admin@neovantas.com', userRoles: ['admin'] })).toString('base64');
const manifest = { schemaVersion: '1.0', publishedAt: '2026-01-01T00:00:00.000Z', documents: {} };
function missingClient() { return { getBlobClient: () => ({ download: async () => { const error = new Error('missing'); error.statusCode = 404; error.code = 'BlobNotFound'; throw error; } }) }; }

(async () => {
  const oldPublicClient = publicKnowledge.createBlobClient;
  const oldInternalClient = knowledgeIndex.createIndexReadContainerClient;
  const oldFetch = global.fetch;
  const oldEnv = { ...process.env };
  process.env.PUBLIC_KNOWLEDGE_STORAGE_ACCOUNT = 'public-test';
  process.env.PUBLIC_KNOWLEDGE_CONTAINER = 'public-test';
  process.env.PUBLIC_KNOWLEDGE_READ_SAS_TOKEN = 'read-only';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_MODEL = 'gpt-4.1-mini';
  publicKnowledge.createBlobClient = () => missingClient();
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ status: 'completed', output_text: JSON.stringify({ answer: 'Respuesta general sin fuente web publicada.', references: [], answerStatus: 'answered', answerType: 'corporate-identity' }), usage: {} }) });
  try {
    const context = { res: null, log() {} };
    await endpoint(context, { headers: { 'x-ms-client-principal': admin }, body: { question: '\u00bfQu\u00e9 servicios ofrece Neovantas?', messages: [] } });
    assert.equal(context.res.status, 200);
    assert.equal(context.res.body.answerStatus, 'answered');
  } finally {
    publicKnowledge.createBlobClient = oldPublicClient;
    knowledgeIndex.createIndexReadContainerClient = oldInternalClient;
    global.fetch = oldFetch;
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
    for (const [key, value] of Object.entries(oldEnv)) process.env[key] = value;
  }
  console.log('knowledge-ask public initialization tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
