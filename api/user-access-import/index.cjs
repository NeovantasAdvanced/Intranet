const { getPrincipalFromRequest } = require('../_shared/auth.cjs');
const { authorizePrincipal } = require('../_shared/hybrid-auth.cjs');
const store = require('../_shared/user-access-store.cjs');
const { MAX_FILE_BYTES, parseWorkbook, compareImport, makeEntity } = require('../_shared/user-access-import.cjs');

function send(context, status, body) { context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) }; }
function parseBody(body) { if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body; try { return JSON.parse(Buffer.isBuffer(body) ? body.toString('utf8') : String(body || '{}')); } catch { return null; } }
function fileFrom(body) { if (typeof body.fileBase64 !== 'string') return null; try { return Buffer.from(body.fileBase64, 'base64'); } catch { return null; } }

module.exports = async function userAccessImport(context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!principal) return send(context, 401, { ok: false, error: 'authentication-required' });
  if (!(await authorizePrincipal(principal, 'admin')).allowed) return send(context, 403, { ok: false, error: 'admin-access-required' });
  const body = parseBody(req?.body);
  if (!body || !['simulate', 'apply'].includes(body.mode)) return send(context, 400, { ok: false, error: 'invalid-request' });
  const file = fileFrom(body);
  if (!file || file.length > MAX_FILE_BYTES) return send(context, 400, { ok: false, error: file?.length > MAX_FILE_BYTES ? 'file-too-large' : 'file-required' });
  try {
    const imported = parseWorkbook(file);
    const existing = await store.listEntities();
    const report = compareImport(imported, existing);
    if (body.mode === 'simulate') return send(context, 200, { ok: true, mode: 'simulate', ...report });
    if (!Array.isArray(body.approvals) || body.approvals.length > report.additions.length + report.matches.length) return send(context, 400, { ok: false, error: 'invalid-approvals' });
    const incoming = new Map(imported.users.map((user) => [user.email, user]));
    const results = [];
    for (const approval of body.approvals) {
      const email = String(approval?.email || '').trim().toLowerCase(); const user = incoming.get(email);
      if (!user || user.blocked || !['create', 'update'].includes(approval.action)) { results.push({ email, status: 'skipped' }); continue; }
      const existingEntity = existing.find((entity) => entity.partitionKey === 'users' && String(entity.email || '').toLowerCase() === email);
      if (approval.action === 'update' && existingEntity && store.parsePermissions(existingEntity).admin === true) { results.push({ email, status: 'admin-protected' }); continue; }
      const permissions = approval.permissions && typeof approval.permissions === 'object' ? { intranet: Boolean(approval.permissions.intranet), repositories: Boolean(approval.permissions.repositories), neo: Boolean(approval.permissions.neo), admin: Boolean(approval.permissions.admin) } : existingEntity ? store.parsePermissions(existingEntity) : user.proposedPermissions;
      if (permissions.admin === true) { results.push({ email, status: 'admin-protected' }); continue; }
      if (approval.action === 'update' && existingEntity) {
        const updated = await store.updateEntity(existingEntity.rowKey, { permissions: JSON.stringify(permissions), displayName: user.displayName, jobTitle: user.jobTitle, objectId: user.objectId });
        await store.appendAudit({ action: 'import-update', targetRowKey: updated.rowKey, actorUserId: String(principal.userId || ''), actorEmail: String(principal.userDetails || '').toLowerCase(), changes: JSON.stringify({ permissions }) });
        results.push({ email, status: 'updated' });
      } else if (approval.action === 'create' && !existingEntity) {
        const created = await store.createEntity(makeEntity(user, permissions));
        await store.appendAudit({ action: 'import-create', targetRowKey: created.rowKey, actorUserId: String(principal.userId || ''), actorEmail: String(principal.userDetails || '').toLowerCase(), changes: JSON.stringify({ permissions }) });
        results.push({ email, status: 'created' });
      } else results.push({ email, status: 'skipped' });
    }
    return send(context, 200, { ok: true, mode: 'apply', applied: results });
  } catch (error) {
    const code = Number(error?.statusCode || error?.status || 0);
    return send(context, code === 409 ? 409 : code === 412 ? 412 : code === 400 ? 400 : 503, { ok: false, error: code === 409 ? 'conflict' : code === 412 ? 'concurrency-conflict' : code === 400 ? 'invalid-request' : 'storage-error' });
  }
};
