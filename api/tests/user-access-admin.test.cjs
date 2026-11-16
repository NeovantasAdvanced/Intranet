const assert = require('node:assert/strict');
const handler = require('../user-access-admin/index.cjs');
const store = require('../_shared/user-access-store.cjs');

const previous = process.env.CORPORATE_ALLOWED_USER_IDS;
process.env.CORPORATE_ALLOWED_USER_IDS = 'admin-id';
const entities = new Map();
const fake = {
  async getEntity(partition, key) { if (!entities.has(key)) { const error = new Error('missing'); error.statusCode = 404; throw error; } return { ...entities.get(key), etag: 'e1' }; },
  async updateEntity(entity) { entities.set(entity.rowKey, entity); },
  async *listEntities() { yield* entities.values(); },
};
const encoded = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
const contextFor = () => ({ res: null });

(async () => {
  store.setUserAccessTableClientForTests(fake);
  const admin = encoded({ identityProvider: 'aad', userId: 'admin-id', userDetails: 'admin@neovantas.com', userRoles: ['admin'] });
  const target = { partitionKey: 'users', rowKey: 'target-row', email: 'aare@neovantas.com', status: 'pending', permissions: JSON.stringify({ intranet: false, neo: false, repositories: false, admin: false }) };
  entities.set(target.rowKey, target);
  const update = contextFor();
  await handler(update, { method: 'POST', headers: { 'x-ms-client-principal': admin }, body: { rowKey: target.rowKey, status: 'active', permissions: { intranet: true, neo: false, repositories: true, admin: false } } });
  assert.equal(update.res.status, 200);
  assert.equal(JSON.parse(update.res.body).user.status, 'active');
  const self = contextFor();
  const selfRow = store.rowKey({ identityProvider: 'aad', userId: 'admin-id' });
  await handler(self, { method: 'POST', headers: { 'x-ms-client-principal': admin }, body: { rowKey: selfRow, status: 'revoked' } });
  assert.equal(self.res.status, 403);
  const employee = contextFor();
  await handler(employee, { method: 'GET', headers: { 'x-ms-client-principal': encoded({ identityProvider: 'aad', userId: 'employee-id', userDetails: 'employee@neovantas.com', userRoles: [] }) } });
  assert.equal(employee.res.status, 403);
  store.resetUserAccessTableClientForTests();
  if (previous === undefined) delete process.env.CORPORATE_ALLOWED_USER_IDS; else process.env.CORPORATE_ALLOWED_USER_IDS = previous;
  console.log('user access admin tests passed');
})().catch((error) => { store.resetUserAccessTableClientForTests(); if (previous === undefined) delete process.env.CORPORATE_ALLOWED_USER_IDS; else process.env.CORPORATE_ALLOWED_USER_IDS = previous; throw error; });
