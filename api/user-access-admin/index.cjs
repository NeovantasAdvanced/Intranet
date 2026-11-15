const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');
const { listEntities, updateEntity, parsePermissions } = require('../_shared/user-access-store.cjs');

function send(context, status, body) { context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) }; }

module.exports = async function userAccessAdmin(context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!principal) return send(context, 401, { ok: false, error: 'authentication-required' });
  if (!isAdminPrincipal(principal)) return send(context, 403, { ok: false, error: 'admin-access-required' });
  try {
    if (String(req.method || 'GET').toUpperCase() === 'GET') {
      const users = await listEntities();
      return send(context, 200, { ok: true, users: users.map((user) => ({ ...user, permissions: parsePermissions(user) })) });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const rowKey = String(body.rowKey || '').trim();
    const status = ['pending', 'active', 'suspended', 'revoked'].includes(body.status) ? body.status : null;
    if (!rowKey || !status || rowKey.length > 128) return send(context, 400, { ok: false, error: 'invalid-request' });
    const permissions = body.permissions && typeof body.permissions === 'object' ? {
      intranet: Boolean(body.permissions.intranet),
      neo: Boolean(body.permissions.neo),
      repositories: Boolean(body.permissions.repositories),
      admin: Boolean(body.permissions.admin),
    } : undefined;
    if (permissions?.admin && !isAdminPrincipal(principal)) return send(context, 403, { ok: false, error: 'admin-escalation-denied' });
    const entity = await updateEntity(rowKey, { status, ...(permissions ? { permissions: JSON.stringify(permissions) } : {}), approvedBy: status === 'active' ? String(principal.userId || '') : undefined });
    return send(context, 200, { ok: true, user: { rowKey: entity.rowKey, status: entity.status, permissions: parsePermissions(entity) } });
  } catch {
    return send(context, 503, { ok: false, error: 'storage-error' });
  }
};
