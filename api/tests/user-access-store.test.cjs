const assert = require('node:assert/strict');
const store = require('../_shared/user-access-store.cjs');

const entities = new Map();
const fakeClient = {
  async createEntity(entity) { if (entities.has(entity.rowKey)) { const error = new Error('exists'); error.statusCode = 409; throw error; } entities.set(entity.rowKey, { ...entity }); },
  async getEntity(partitionKey, rowKey) { if (!entities.has(rowKey)) { const error = new Error('missing'); error.statusCode = 404; throw error; } return { ...entities.get(rowKey), etag: 'etag-1' }; },
  async updateEntity(entity) { entities.set(entity.rowKey, { ...entity }); },
  async *listEntities() { yield* entities.values(); },
};

store.setUserAccessTableClientForTests(fakeClient);
(async () => {
  const principal = { identityProvider: 'aad', userId: 'employee-id', userDetails: 'aare@neovantas.com' };
  const first = await store.requestAccess(principal);
  assert.equal(first.status, 'not-registered');
  assert.equal((await store.requestAccess(principal)).status, 'not-registered');
  assert.equal((await store.requestAccess({ identityProvider: 'aad', userId: 'external-id', userDetails: 'outside@example.com' })).status, 'not-in-corporate-roster');
  const imported = store.buildImportedEntity({ email: 'aare@neovantas.com', userPrincipalName: 'aare@neovantas.com', displayName: 'Aare' });
  await fakeClient.createEntity(imported);
  const linked = await store.requestAccess(principal);
  assert.equal(linked.status, 'active');
  assert.equal(linked.entity.staticWebAppsUserId, 'employee-id');
  assert.equal(store.parsePermissions(linked.entity).intranet, true);
  assert.equal((await store.listEntities()).length, 1);
  store.resetUserAccessTableClientForTests();
  console.log('user access store tests passed');
})().catch((error) => { store.resetUserAccessTableClientForTests(); throw error; });
