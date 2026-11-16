const assert = require('node:assert/strict');
const handler = require('../portal-data/index.cjs');
const store = require('../_shared/user-access-store.cjs');

const entities = new Map();
const fake = {
  async getEntity(_partition, key) {
    if (!entities.has(key)) { const error = new Error('missing'); error.statusCode = 404; throw error; }
    return { ...entities.get(key), etag: 'e1' };
  },
  async *listEntities() { yield* entities.values(); },
  async updateEntity(entity) { entities.set(entity.rowKey, { ...entity }); },
};
const principal = (id, email, roles = ['authenticated']) => Buffer.from(JSON.stringify({ identityProvider: 'aad', userId: id, userDetails: email, userRoles: roles })).toString('base64');
const rawPrincipal = (id, email, roles = ['authenticated']) => ({ identityProvider: 'aad', userId: id, userDetails: email, userRoles: roles });
const context = () => ({ res: null });

(async () => {
  store.setUserAccessTableClientForTests(fake);
  const admin = rawPrincipal('admin-id', 'admin@neovantas.com', ['admin']);
  const repo = rawPrincipal('repo-id', 'aare@neovantas.com');
  const employee = rawPrincipal('employee-id', 'employee@neovantas.com');
  const suspended = rawPrincipal('suspended-id', 'suspended@neovantas.com');
  for (const [p, permissions, status = 'active'] of [
    [admin, { intranet: true, neo: true, repositories: true, admin: true }],
    [repo, { intranet: true, neo: false, repositories: true, admin: false }],
    [employee, { intranet: true, neo: false, repositories: false, admin: false }],
    [suspended, { intranet: true, neo: true, repositories: true, admin: true }, 'suspended'],
  ]) {
    entities.set(store.rowKey(p), { identityProvider: 'aad', staticWebAppsUserId: p.userId, email: p.userDetails, userPrincipalName: p.userDetails, status, permissions: JSON.stringify(permissions) });
  }

  async function invoke(p, query = {}) { const c = context(); await handler(c, { headers: { 'x-ms-client-principal': principal(p.userId, p.userDetails, p.userRoles) }, query }); return c.res; }
  assert.equal(JSON.parse((await invoke(admin)).body).profile.canViewRepositories, true);
  assert.equal(JSON.parse((await invoke(admin, { scope: 'admin' })).body).profile.isAdmin, true);
  assert.equal(JSON.parse((await invoke(repo)).body).profile.canViewRepositories, true);
  assert.equal(JSON.parse((await invoke(employee)).body).profile.canViewRepositories, false);
  assert.equal((await invoke(suspended)).status, 403);

  store.setUserAccessTableClientForTests({ async getEntity() { const error = new Error('not-configured'); error.statusCode = 404; throw error; }, async *listEntities() {} });
  process.env.CORPORATE_ALLOWED_USER_IDS = 'legacy-id';
  const legacy = context();
  await handler(legacy, { headers: { 'x-ms-client-principal': principal('legacy-id', 'legacy@neovantas.com') }, query: {} });
  assert.equal(legacy.res.status, 200);
  assert.equal(JSON.parse(legacy.res.body).profile.canViewRepositories, false);
  delete process.env.CORPORATE_ALLOWED_USER_IDS;
  store.resetUserAccessTableClientForTests();
  console.log('portal data permission tests passed');
})().catch((error) => { store.resetUserAccessTableClientForTests(); delete process.env.CORPORATE_ALLOWED_USER_IDS; throw error; });
