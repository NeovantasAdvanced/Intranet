const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const handler = require('../user-access-import/index.cjs');
const store = require('../_shared/user-access-store.cjs');

const previous = process.env.CORPORATE_ALLOWED_USER_IDS;
process.env.CORPORATE_ALLOWED_USER_IDS = 'admin-id';
const entities = new Map(); let writes = 0;
const fake = {
  async createEntity(entity) { if (entities.has(entity.rowKey)) { const error = new Error('exists'); error.statusCode = 409; throw error; } writes += 1; entities.set(entity.rowKey, { ...entity }); },
  async getEntity(_partition, key) { if (!entities.has(key)) { const error = new Error('missing'); error.statusCode = 404; throw error; } return { ...entities.get(key), etag: 'etag-1' }; },
  async updateEntity(entity) { writes += 1; entities.set(entity.rowKey, { ...entity }); },
  async *listEntities() { yield* entities.values(); },
};
const principal = Buffer.from(JSON.stringify({ identityProvider: 'aad', userId: 'admin-id', userDetails: 'admin@neovantas.com', userRoles: ['admin'] })).toString('base64');
const invoke = async (body) => { const context = { res: null }; await handler(context, { method: 'POST', headers: { 'x-ms-client-principal': principal }, body }); return context.res; };

(async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Users');
  sheet.columns = [
    { header: 'Display name', key: 'displayName' }, { header: 'User principal name', key: 'email' },
    { header: 'Title', key: 'title' }, { header: 'Object Id', key: 'objectId' }, { header: 'Block credential', key: 'blocked' },
  ];
  sheet.addRows([
    ['Analyst Nuevo', 'new@neovantas.com', 'Analyst', 'oid-1', 'False'],
    ['Consultant Nuevo', 'consultant@neovantas.com', 'Consultant', 'oid-2', 'False'],
    ['Bloqueada', 'blocked@neovantas.com', 'Consultant', 'oid-3', 'True'],
    ['Existente', 'existing@neovantas.com', 'Consultant', 'oid-4', 'False'],
  ]);
  const fileBase64 = await workbook.xlsx.writeBuffer().then((buffer) => Buffer.from(buffer).toString('base64'));
  store.setUserAccessTableClientForTests(fake);
  entities.set('existing-row', { partitionKey: 'users', rowKey: 'existing-row', email: 'existing@neovantas.com', status: 'active', permissions: JSON.stringify({ intranet: true, repositories: false, neo: false, admin: false }) });
  const simulation = await invoke({ mode: 'simulate', fileBase64 });
  const report = JSON.parse(simulation.body);
  assert.equal(simulation.status, 200); assert.equal(report.counts.additions, 2); assert.equal(report.counts.matches, 1); assert.equal(report.counts.blocked, 1); assert.equal(writes, 0);
  assert.equal(report.additions.find((user) => user.email === 'new@neovantas.com').proposedPermissions.repositories, false);
  assert.equal(report.additions.find((user) => user.email === 'consultant@neovantas.com').proposedPermissions.repositories, true);
  const applied = await invoke({ mode: 'apply', fileBase64, approvals: [{ email: 'new@neovantas.com', action: 'create', permissions: { intranet: true, repositories: false, neo: false, admin: false } }, { email: 'existing@neovantas.com', action: 'update', permissions: { intranet: true, repositories: true, neo: false, admin: false } }] });
  assert.equal(applied.status, 200); assert.equal(JSON.parse(applied.body).applied[0].status, 'created');
  assert.equal(JSON.parse(applied.body).applied[1].status, 'updated');
  assert.equal(JSON.parse(entities.get('existing-row').permissions).repositories, true);
  assert.equal([...entities.values()].find((entity) => entity.email === 'new@neovantas.com').entraObjectId, 'oid-1');
  assert.ok([...entities.values()].some((entity) => entity.partitionKey === 'audit' && entity.action === 'import-create'));
  const blockedApply = await invoke({ mode: 'apply', fileBase64, approvals: [{ email: 'blocked@neovantas.com', action: 'create' }] });
  assert.equal(JSON.parse(blockedApply.body).applied[0].status, 'skipped');
  store.resetUserAccessTableClientForTests();
  if (previous === undefined) delete process.env.CORPORATE_ALLOWED_USER_IDS; else process.env.CORPORATE_ALLOWED_USER_IDS = previous;
  console.log('user access import tests passed');
})().catch((error) => { store.resetUserAccessTableClientForTests(); if (previous === undefined) delete process.env.CORPORATE_ALLOWED_USER_IDS; else process.env.CORPORATE_ALLOWED_USER_IDS = previous; throw error; });
