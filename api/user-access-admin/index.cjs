const { getPrincipalFromRequest, getPrincipalEmailCandidates, normalizeEmail } = require('../_shared/auth.cjs');
const { authorizePrincipal } = require('../_shared/hybrid-auth.cjs');
const { listEntities, updateEntity, createEntity, appendAudit, parsePermissions, defaultPermissionsForJobTitle, emailRowKey, rowKey } = require('../_shared/user-access-store.cjs');

function send(context, status, body) { context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) }; }

module.exports = async function userAccessAdmin(context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!principal) return send(context, 401, { ok: false, error: 'authentication-required' });
  if (!(await authorizePrincipal(principal, 'admin')).allowed) return send(context, 403, { ok: false, error: 'admin-access-required' });
  try {
    if (String(req.method || 'GET').toUpperCase() === 'GET') {
      const users = await listEntities();
      return send(context, 200, { ok: true, users: users.map((user) => ({ ...user, permissions: parsePermissions(user) })) });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (body.action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      const displayName = String(body.displayName || '').trim();
      const jobTitle = String(body.jobTitle || '').trim();
      if (!email || !email.endsWith('@neovantas.com') || !displayName || email.length > 254 || displayName.length > 200 || jobTitle.length > 200) return send(context, 400, { ok: false, error: 'invalid-request' });
      const users = await listEntities();
      if (users.some((user) => String(user.email || user.userPrincipalName || '').trim().toLowerCase() === email)) return send(context, 409, { ok: false, error: 'user-already-exists' });
      const defaults = defaultPermissionsForJobTitle(jobTitle);
      const permissions = { ...defaults, ...(body.permissions && typeof body.permissions === 'object' ? {
        repositories: Boolean(body.permissions.repositories), neo: Boolean(body.permissions.neo), admin: Boolean(body.permissions.admin),
      } : {}) };
      const now = new Date().toISOString();
      const entity = await createEntity({ rowKey: emailRowKey(email), email, userPrincipalName: email, displayName, jobTitle, status: 'active', permissions: JSON.stringify(permissions), identityProvider: '', staticWebAppsUserId: '', createdAt: now, updatedAt: now });
      await appendAudit({ action: 'create', targetRowKey: entity.rowKey, actorUserId: String(principal.userId || ''), actorEmail: String(principal.userDetails || '').trim().toLowerCase(), changes: JSON.stringify({ status: entity.status, permissions }) });
      return send(context, 201, { ok: true, user: { ...entity, permissions } });
    }
    const rowKey = String(body.rowKey || '').trim();
    const status = ['pending', 'active', 'suspended', 'revoked'].includes(body.status) ? body.status : null;
    if (!rowKey || !status || rowKey.length > 128) return send(context, 400, { ok: false, error: 'invalid-request' });
    if (rowKey === rowKeyForPrincipal(principal)) return send(context, 403, { ok: false, error: 'self-modification-denied' });
    const permissions = body.permissions && typeof body.permissions === 'object' ? {
      intranet: Boolean(body.permissions.intranet),
      neo: Boolean(body.permissions.neo),
      repositories: Boolean(body.permissions.repositories),
      admin: Boolean(body.permissions.admin),
    } : undefined;
    if (permissions?.admin && !(await authorizePrincipal(principal, 'admin')).allowed) return send(context, 403, { ok: false, error: 'admin-escalation-denied' });
    const current = (await listEntities()).find((item) => item.rowKey === rowKey);
    if (!current) return send(context, 404, { ok: false, error: 'user-not-found' });
    const principalEmails = new Set(getPrincipalEmailCandidates(principal).map(normalizeEmail));
    if (rowKey === rowKeyForPrincipal(principal) || (current.email && principalEmails.has(normalizeEmail(current.email))) || (current.staticWebAppsUserId && current.staticWebAppsUserId === principal.userId)) return send(context, 403, { ok: false, error: 'self-modification-denied' });
    const currentPermissions = parsePermissions(current);
    const nextPermissions = permissions || currentPermissions;
    if ((currentPermissions.admin === true && (status !== 'active' || nextPermissions.admin !== true)) && (await listEntities()).filter((item) => item.rowKey !== rowKey && item.status === 'active' && parsePermissions(item).admin === true).length === 0) return send(context, 409, { ok: false, error: 'last-admin-protected' });
    const entity = await updateEntity(rowKey, { status, ...(permissions ? { permissions: JSON.stringify(permissions) } : {}), ...(status === 'active' ? { approvedBy: String(principal.userId || '') } : {}) });
    await appendAudit({ action: 'update', targetRowKey: rowKey, actorUserId: String(principal.userId || ''), actorEmail: String(principal.userDetails || '').trim().toLowerCase(), changes: JSON.stringify({ status, permissions: nextPermissions }) });
    return send(context, 200, { ok: true, user: { rowKey: entity.rowKey, status: entity.status, permissions: parsePermissions(entity) } });
  } catch {
    return send(context, 503, { ok: false, error: 'storage-error' });
  }
};

function rowKeyForPrincipal(principal) { return rowKey(principal); }
