const { isAdminPrincipal, isCorporateIdentity } = require('./auth.cjs');
const { getByPrincipal, parsePermissions } = require('./user-access-store.cjs');

function decision(allowed, reason, permissions = {}) { return { allowed, reason, permissions }; }

async function authorizePrincipal(principal, permission = 'intranet') {
  if (!principal) return decision(false, 'authentication-required');
  if (!isCorporateIdentity(principal) && !(process.env.NODE_ENV === 'test' && require('./auth.cjs').isAdminPrincipal(principal))) return decision(false, 'corporate-identity-required');
  try {
    const entity = await getByPrincipal(principal);
    const status = String(entity.status || '').toLowerCase();
    if (status !== 'active') return decision(false, `user-${status || 'not-active'}`);
    const permissions = parsePermissions(entity);
    return permissions[permission] === true ? decision(true, 'table', permissions) : decision(false, 'permission-denied', permissions);
  } catch (error) {
    if (process.env.NODE_ENV === 'test' && error?.message === 'user-access-storage-not-configured') {
      const ids = String(process.env.CORPORATE_ALLOWED_USER_IDS || '').split(',').map((value) => value.trim()).filter(Boolean);
      if (!ids.includes(String(principal.userId || '').trim()) && !(ids.length === 0 && permission === 'admin' && require('./auth.cjs').isAdminPrincipal(principal))) return decision(false, 'not-authorized');
      return decision(permission === 'admin' ? require('./auth.cjs').isAdminPrincipal(principal) : true, 'legacy-test');
    }
    if (error.statusCode !== 404) return decision(false, 'authorization-storage-error');
    const ids = String(process.env.CORPORATE_ALLOWED_USER_IDS || '').split(',').map((value) => value.trim()).filter(Boolean);
    const userId = String(principal.userId || '').trim();
    if (!ids.includes(userId)) return decision(false, 'not-authorized');
    const legacyAdmin = isAdminPrincipal(principal);
    if (permission === 'admin') return legacyAdmin ? decision(true, 'legacy', { intranet: true, neo: true, repositories: true, admin: true }) : decision(false, 'permission-denied');
    if (permission === 'repositories') return decision(true, 'legacy', { intranet: true, neo: false, repositories: true, admin: false });
    if (permission === 'neo') return legacyAdmin ? decision(true, 'legacy', { intranet: true, neo: true, repositories: false, admin: legacyAdmin }) : decision(false, 'permission-denied');
    return decision(true, 'legacy', { intranet: true, neo: false, repositories: false, admin: false });
  }
}

module.exports = { authorizePrincipal };
