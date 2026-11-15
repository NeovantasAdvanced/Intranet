const assert = require('node:assert/strict');
const publish = require('../knowledge-web-publish/index.cjs');
const web = require('../_shared/public-knowledge.cjs');
const admin = Buffer.from(JSON.stringify({ userDetails: 'admin@neovantas.com', userRoles: ['admin'] })).toString('base64');
(async () => {
  const oldClient = web.createBlobClient; const oldEnv = { ...process.env }; let writes = 0;
  process.env.PUBLIC_KNOWLEDGE_STORAGE_ACCOUNT = 'test'; process.env.PUBLIC_KNOWLEDGE_CONTAINER = 'public'; process.env.PUBLIC_KNOWLEDGE_READ_SAS_TOKEN = 'read'; process.env.PUBLIC_KNOWLEDGE_WRITE_SAS_TOKEN = 'write';
  web.createBlobClient = () => ({ getBlobClient: () => ({ download: async () => ({ readableStreamBody: [Buffer.from(JSON.stringify({ status: 'partial', schemaVersion: '1.0', pages: [{ url: 'https://www.neovantas.com/servicios', title: 'Servicios', chunks: [{ id: 'x', text: 'contenido' }] }], diagnostics: { pendingCount: 2 } }))] }) }), getBlockBlobClient: () => ({ uploadData: async () => { writes += 1; } }) });
  try { const context = { res: null, log() {} }; await publish(context, { headers: { 'x-ms-client-principal': admin }, body: { candidateId: 'a'.repeat(24) } }); assert.equal(context.res.status, 409); assert.equal(context.res.body.publishStatus, 'partial-candidate-not-publishable'); assert.equal(writes, 0); } finally { web.createBlobClient = oldClient; for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key]; for (const [key, value] of Object.entries(oldEnv)) process.env[key] = value; }
  console.log('knowledge-web-partial tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
