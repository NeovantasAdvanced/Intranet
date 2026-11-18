const assert = require('node:assert/strict');
const handler = require('../user-access-admin/index.cjs');
const store = require('../_shared/user-access-store.cjs');

const previous = process.env.CORPORATE_ALLOWED_USER_IDS;
process.env.CORPORATE_ALLOWED_USER_IDS = 'admin-id';
const entities = new Map();
let updateStatus = 0;
const fake = {
  async createEntity(entity) { if (entities.has(entity.rowKey)) { const error = new Error('exists'); error.statusCode = 409; throw error; } entities.set(entity.rowKey, { ...entity }); },
  async getEntity(partition, key) { if (!entities.has(key)) { const error = new Error('missing'); error.statusCode = 404; throw error; } return { ...entities.get(key), etag: 'e1' }; },
  async updateEntity(entity) { if (updateStatus) { const error = new Error('update-conflict'); error.statusCode = updateStatus; updateStatus = 0; throw error; } entities.set(entity.rowKey, entity); },
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
  const permissionOnly = contextFor();
  await handler(permissionOnly, { method: 'POST', headers: { 'x-ms-client-principal': admin }, body: { rowKey: target.rowKey, permissions: { intranet: true, neo: true, repositories: true, admin: false } } });
  assert.equal(permissionOnly.res.status, 200);
  assert.equal(JSON.parse(permissionOnly.res.body).user.status, 'active');
  assert.equal(JSON.parse(permissionOnly.res.body).user.permissions.neo, true);
  assert.equal(entities.get(target.rowKey).status, 'active');
  const statusOnly = contextFor();
  await handler(statusOnly, { method: 'POST', headers: { 'x-ms-client-principal': admin }, body: { rowKey: target.rowKey, status: 'suspended' } });
  assert.equal(statusOnly.res.status, 200);
  assert.equal(JSON.parse(statusOnly.res.body).user.status, 'suspended');
  assert.equal(JSON.parse(statusOnly.res.body).user.permissions.neo, true);
  const invalidStatus = contextFor();
  await handler(invalidStatus, { method: 'POST', headers: { 'x-ms-client-principal': admin }, body: { rowKey: target.rowKey, status: 'enabled', permissions: { intranet: true, neo: true, repositories: true, admin: false } } });
  assert.equal(invalidStatus.res.status, 400);
  const simultaneous = contextFor();
  await handler(simultaneous, { method: 'POST', headers: { 'x-ms-client-principal': admin }, body: { rowKey: target.rowKey, status: 'active', permissions: { intranet: true, neo: false, repositories: true, admin: false } } });
  assert.equal(simultaneous.res.status, 200);
  assert.equal(JSON.parse(simultaneous.res.body).user.status, 'active');
  assert.equal(JSON.parse(simultaneous.res.body).user.permissions.neo, false);
  const create = contextFor();
  await handler(create, { method: 'POST', headers: { 'x-ms-client-principal': admin }, body: { action: 'create', displayName: 'Nuevo Usuario', email: 'nuevo@neovantas.com', jobTitle: 'Consultant' } });
  assert.equal(create.res.status, 201);
  const created = JSON.parse(create.res.body).user;
  assert.equal(created.permissions.intranet, true);
  assert.equal(created.permissions.repositories, true);
  assert.equal(entities.get(created.rowKey).partitionKey, 'users');
  assert.ok([...entities.values()].some((entity) => entity.partitionKey === 'audit' && entity.action === 'create'));
  const duplicate = contextFor();
  await handler(duplicate, { method: 'POST', headers: { 'x-ms-client-principal': admin }, body: { action: 'create', displayName: 'Duplicado', email: 'nuevo@neovantas.com', jobTitle: 'Analyst' } });
  assert.equal(duplicate.res.status, 409);
  const linkedAdmin = { partitionKey: 'users', rowKey: 'linked-admin', email: 'admin@neovantas.com', status: 'active', permissions: JSON.stringify({ intranet: true, neo: false, repositories: false, admin: true }) };
  entities.set(linkedAdmin.rowKey, linkedAdmin);
  const linkedSelf = contextFor();
  await handler(linkedSelf, { method: 'POST', headers: { 'x-ms-client-principal': admin }, body: { rowKey: linkedAdmin.rowKey, status: 'suspended' } });
  assert.equal(linkedSelf.res.status, 403);
  entities.delete(linkedAdmin.rowKey);
  const lastAdminRow = { partitionKey: 'users', rowKey: 'last-admin', email: 'last-admin@neovantas.com', status: 'active', permissions: JSON.stringify({ intranet: true, neo: false, repositories: false, admin: true }) };
  entities.set(lastAdminRow.rowKey, lastAdminRow);
  const lastAdmin = contextFor();
  await handler(lastAdmin, { method: 'POST', headers: { 'x-ms-client-principal': admin }, body: { rowKey: lastAdminRow.rowKey, status: 'revoked', permissions: { intranet: true, neo: false, repositories: false, admin: false } } });
  assert.equal(lastAdmin.res.status, 409);
  updateStatus = 412;
  const concurrent = contextFor();
  await handler(concurrent, { method: 'POST', headers: { 'x-ms-client-principal': admin }, body: { rowKey: target.rowKey, status: 'active' } });
  assert.equal(concurrent.res.status, 412);
  updateStatus = 503;
  const persistenceFailure = contextFor();
  await handler(persistenceFailure, { method: 'POST', headers: { 'x-ms-client-principal': admin }, body: { rowKey: target.rowKey, permissions: { intranet: true, neo: true, repositories: true, admin: false } } });
  assert.equal(persistenceFailure.res.status, 503);
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
