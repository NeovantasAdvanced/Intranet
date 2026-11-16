const { getPrincipalFromRequest } = require('../_shared/auth.cjs');
const { authorizePrincipal } = require('../_shared/hybrid-auth.cjs');

const data = {
  assistants: require('../data/assistants.json'),
  news: require('../data/news.json'),
  events: require('../data/events.json'),
  documents: require('../data/documents.json'),
  sharePointCatalog: require('../data/sharepointCatalog.json'),
  apps: require('../data/apps.json'),
  supportAst: require('../data/supportAst.json'),
  quickLinks: require('../data/quickLinks.json'),
};

const adminData = {
  ...data,
  organizationUsers: require('../data/organization-users.json'),
  usersAccess: require('../data/users-access.json'),
  accessControl: require('../data/access-control.json'),
  knowledgeInventory: require('../data/knowledge-inventory.json'),
};

function profileFor(principal, authorization, adminAuthorization) {
  return {
    isAdmin: Boolean(adminAuthorization?.allowed),
    canViewRepositories: authorization.permissions.repositories === true,
  };
}

module.exports = async function portalData(context, req) {
  const principal = getPrincipalFromRequest(req);
  const authorization = await authorizePrincipal(principal, 'intranet');
  if (!authorization.allowed) {
    context.res = { status: principal ? 403 : 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ ok: false, error: principal ? 'Forbidden' : 'Authentication required' }) };
    return;
  }

  const scope = String(req.query?.scope || '').trim().toLowerCase();
  const adminAuthorization = scope === 'admin' ? await authorizePrincipal(principal, 'admin') : null;
  if (scope === 'admin' && !adminAuthorization.allowed) {
    context.res = { status: 403, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ ok: false, error: 'Forbidden' }) };
    return;
  }

  const payload = scope === 'admin' ? adminData : data;
  context.res = { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ ok: true, profile: profileFor(principal, authorization, adminAuthorization), ...payload }) };
};
