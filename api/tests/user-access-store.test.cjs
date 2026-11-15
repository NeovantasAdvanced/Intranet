const assert = require('node:assert/strict');
const store = require('../_shared/user-access-store.cjs');

const entities = new Map();
const fakeClient = {
  async createEntity(entity) { if (entities.has(entity.rowKey)) { const error = new Error('exists'); error.statusCode = 409; throw error; } entities.set(entity.rowKey, { ...entity }); },
  async getEntity(partitionKey, rowKey) { if (!entities.has(rowKey)) { const error = new Error('missing'); error.statusCode = 404; throw error; } return { ...entities.get(rowKey), etag: 'etag-1' }; },
  async updateEntity(entity) { entities.set(entity.rowKey, { ...entity }); },
  listEntities() { return { toArray: async () => [...entities.values()] }; },
};

store.setUserAccessTableClientForTests(fakeClient);
(async () => {
  const principal = { identityProvider: 'aad', userId: 'employee-id', userDetails: 'aare@neovantas.com' };
  const first = await store.requestAccess(principal);
  assert.equal(first.status, 'pending');
  assert.equal(first.entity.status, 'pending');
  assert.equal(first.entity.permissions.includes('"intranet":false'), true);
  assert.equal((await store.requestAccess(principal)).status, 'pending');
  assert.equal((await store.requestAccess({ identityProvider: 'aad', userId: 'external-id', userDetails: 'outside@example.com' })).status, 'not-in-corporate-roster');
  const updated = await store.updateEntity(first.entity.rowKey, { status: 'active', permissions: JSON.stringify({ intranet: true, neo: false, repositories: true, admin: false }) });
  assert.equal(updated.status, 'active');
  assert.equal(store.parsePermissions(updated).admin, false);
  assert.equal((await store.listEntities()).length, 1);
  store.resetUserAccessTableClientForTests();
  console.log('user access store tests passed');
})().catch((error) => { store.resetUserAccessTableClientForTests(); throw error; });
