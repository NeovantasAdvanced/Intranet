const assert = require('node:assert/strict');
const handler = require('../knowledge-extract/index.cjs');

async function invoke(headers = {}) {
  const context = { log() {} };
  await handler(context, { headers });
  return context.res;
}

(async () => {
  const names = ['KNOWLEDGE_STORAGE_ACCOUNT', 'KNOWLEDGE_CONTAINER', 'KNOWLEDGE_BLOB_SAS_TOKEN'];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  names.forEach((name) => delete process.env[name]);
  try {
    assert.equal((await invoke()).status, 401);
    assert.equal((await invoke({ 'x-ms-client-principal': Buffer.from(JSON.stringify({ userDetails: 'employee@neovantas.com' })).toString('base64') })).status, 403);
    const admin = Buffer.from(JSON.stringify({ userDetails: 'admin@neovantas.com', userRoles: ['authenticated', 'admin'] })).toString('base64');
    assert.equal((await invoke({ 'x-ms-client-principal': admin })).status, 503);
  } finally {
    names.forEach((name) => saved[name] === undefined ? delete process.env[name] : process.env[name] = saved[name]);
  }
  console.log('knowledge-extract tests passed');
})();
