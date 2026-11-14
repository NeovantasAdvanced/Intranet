const assert = require('node:assert/strict');
const diagnostics = require('../knowledge-diagnostics/index.cjs');

function encodedPrincipal(principal) {
  return Buffer.from(JSON.stringify(principal)).toString('base64');
}

async function invoke(headers = {}) {
  const context = { res: null, log: { error() {} } };
  await diagnostics(context, { headers });
  return context.res;
}

async function run() {
  assert.equal((await invoke()).status, 401);

  const employee = encodedPrincipal({ userDetails: 'employee@neovantas.com', userRoles: ['authenticated'], claims: [] });
  assert.equal((await invoke({ 'x-ms-client-principal': employee })).status, 403);

  const admin = encodedPrincipal({ userDetails: 'admin@neovantas.com', userRoles: ['authenticated', 'admin'], claims: [] });
  const missingConfig = await invoke({ 'x-ms-client-principal': admin });
  assert.equal(missingConfig.status, 200);
  assert.deepEqual(JSON.parse(missingConfig.body), {
    ok: true,
    configured: false,
    connection: 'not-tested',
    documents: [],
  });
}

run().then(() => console.log('knowledge-diagnostics tests passed'));
