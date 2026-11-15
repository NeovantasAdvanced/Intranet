const assert = require('node:assert/strict');
const auth = require('../_shared/auth.cjs');
const handler = require('../portal-data/index.cjs');

const original = process.env.CORPORATE_ALLOWED_USER_IDS;
process.env.CORPORATE_ALLOWED_USER_IDS = 'employee-id,admin-id';

function encoded(value) { return Buffer.from(JSON.stringify(value)).toString('base64'); }
function principal(userId, userDetails, identityProvider = 'aad', userRoles = ['authenticated']) {
  return encoded({ userId, userDetails, identityProvider, userRoles });
}
async function invoke(header, query = {}) { const context = { res: null }; await handler(context, { headers: { 'x-ms-client-principal': header }, query }); return context.res; }

(async () => {
  assert.equal(auth.isCorporatePrincipal({ userId: 'employee-id', userDetails: 'employee@neovantas.com', identityProvider: 'aad' }), true);
  assert.equal(auth.isCorporatePrincipal({ userId: 'other-id', userDetails: 'employee@neovantas.com', identityProvider: 'aad' }), false);
  assert.equal(auth.isCorporatePrincipal({ userId: 'employee-id', userDetails: 'employee@neovantas.com', identityProvider: 'github' }), false);
  assert.equal(auth.isCorporatePrincipal({ userId: 'employee-id', userDetails: 'employee@gmail.com', identityProvider: 'aad' }), false);
  delete process.env.CORPORATE_ALLOWED_USER_IDS;
  assert.equal(auth.isCorporatePrincipal({ userId: 'employee-id', userDetails: 'employee@neovantas.com', identityProvider: 'aad' }), false);
  process.env.CORPORATE_ALLOWED_USER_IDS = 'employee-id,admin-id';
  assert.equal((await invoke(principal('employee-id', 'employee@neovantas.com'))).status, 200);
  assert.equal((await invoke(principal('employee-id', 'employee@neovantas.com'), { scope: 'admin' })).status, 403);
  assert.equal((await invoke(principal('admin-id', 'admin@neovantas.com', 'aad', ['admin']))).status, 200);
  assert.equal((await invoke(principal('other-id', 'employee@neovantas.com'))).status, 403);
  assert.equal((await invoke(null)).status, 401);
  if (original === undefined) delete process.env.CORPORATE_ALLOWED_USER_IDS; else process.env.CORPORATE_ALLOWED_USER_IDS = original;
  console.log('corporate auth tests passed');
})().catch((error) => { if (original === undefined) delete process.env.CORPORATE_ALLOWED_USER_IDS; else process.env.CORPORATE_ALLOWED_USER_IDS = original; throw error; });
