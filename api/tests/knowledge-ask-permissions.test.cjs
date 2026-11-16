const assert = require('node:assert/strict');
const endpoint = require('../knowledge-ask/index.cjs');
const store = require('../_shared/user-access-store.cjs');
const knowledgeIndex = require('../_shared/knowledge-index.cjs');
const search = require('../_shared/knowledge-search.cjs');

const entities = new Map();
const fake = {
  async getEntity(_partition, key) {
    if (!entities.has(key)) { const error = new Error('missing'); error.statusCode = 404; throw error; }
    return entities.get(key);
  },
  async *listEntities() { yield* entities.values(); },
};
const principal = (id, email) => ({ identityProvider: 'aad', userId: id, userDetails: email, userRoles: ['authenticated'] });
const header = (value) => ({ 'x-ms-client-principal': Buffer.from(JSON.stringify(value)).toString('base64') });

(async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  const previousConfig = knowledgeIndex.getIndexReadStorageConfig;
  const previousLoad = search.loadPublishedIndexes;
  const previousSearch = search.searchIndexes;
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_MODEL = 'test-model';
  knowledgeIndex.getIndexReadStorageConfig = () => ({ configured: true });
  search.loadPublishedIndexes = async () => ({ indexes: [] });
  search.searchIndexes = () => [];
  const neoUser = principal('neo-user', 'neo@neovantas.com');
  const adminWithoutNeo = principal('admin-no-neo', 'admin-no-neo@neovantas.com');
  const pending = principal('pending-user', 'pending@neovantas.com');
  for (const [value, status, permissions] of [
    [neoUser, 'active', { intranet: true, neo: true, admin: false }],
    [adminWithoutNeo, 'active', { intranet: true, neo: false, admin: true }],
    [pending, 'pending', { intranet: true, neo: true, admin: false }],
  ]) entities.set(require('../_shared/user-access-store.cjs').rowKey(value), { identityProvider: 'aad', staticWebAppsUserId: value.userId, email: value.userDetails, userPrincipalName: value.userDetails, status, permissions: JSON.stringify(permissions) });
  store.setUserAccessTableClientForTests(fake);
  global.fetch = async () => ({ ok: true, json: async () => ({ output_text: JSON.stringify({ answer: 'respuesta', references: [], answerStatus: 'answered', answerType: 'general-knowledge' }) }) });
  async function invoke(value) { const context = { res: null, log() {} }; await endpoint(context, { headers: header(value), body: { question: '¿Qué es un nudge?' } }); return context.res; }
  assert.equal((await invoke(neoUser)).status, 200);
  assert.equal((await invoke(adminWithoutNeo)).status, 403);
  assert.equal((await invoke(pending)).status, 403);
  store.resetUserAccessTableClientForTests();
  knowledgeIndex.getIndexReadStorageConfig = previousConfig;
  search.loadPublishedIndexes = previousLoad;
  search.searchIndexes = previousSearch;
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  if (previousModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = previousModel;
  console.log('knowledge ask permission tests passed');
})().catch((error) => { store.resetUserAccessTableClientForTests(); delete process.env.OPENAI_API_KEY; throw error; });
