const { getPrincipalFromRequest } = require('../_shared/auth.cjs');
const { requestAccess } = require('../_shared/user-access-store.cjs');

module.exports = async function accessRequest(context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!principal) { context.res = { status: 401, body: JSON.stringify({ ok: false, error: 'authentication-required' }) }; return; }
  try {
    const result = await requestAccess(principal);
    const status = result.status === 'pending' || result.status === 'approved' ? 200 : 403;
    context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ ok: status === 200, requestStatus: result.status }) };
  } catch {
    context.res = { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ ok: false, requestStatus: 'storage-error' }) };
  }
};
