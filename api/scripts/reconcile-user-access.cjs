#!/usr/bin/env node
/*
 * Definitive census reconciliation. Dry-run is the default. Use --apply only
 * after reviewing the JSON report and create a local --backup first.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { parseWorkbook, makeEntity } = require('../_shared/user-access-import.cjs');
const store = require('../_shared/user-access-store.cjs');
const { normalizeEmail } = require('../_shared/auth.cjs');

function arg(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : ''; }
function has(name) { return process.argv.includes(name); }
function policy(user) {
  const email = normalizeEmail(user.email);
  if (email === 'fmacias@neovantas.com' || email === 'fernando.macias@neovantas.com') return { intranet: true, repositories: true, neo: true, admin: true };
  if (email === 'mortiz@neovantas.com') return { intranet: true, repositories: true, neo: true, admin: false };
  return user.proposedPermissions;
}
function withoutAccess() { return { intranet: false, repositories: false, neo: false, admin: false }; }
function emailOf(entity) { return normalizeEmail(entity.email || entity.userPrincipalName); }
function objectIdOf(value) { return String(value?.entraObjectId || value?.objectId || '').trim().toLowerCase(); }

async function main() {
  const input = arg('--input') || path.resolve(process.cwd(), '../Usuarios.xlsx');
  const backup = arg('--backup');
  const workbook = await fs.readFile(input);
  const imported = await parseWorkbook(workbook);
  const existing = await store.listEntities();
  const byEmail = new Map(existing.filter((entity) => emailOf(entity)).map((entity) => [emailOf(entity), entity]));
  const byObjectId = new Map(existing.filter((entity) => objectIdOf(entity)).map((entity) => [objectIdOf(entity), entity]));
  const incoming = new Map(imported.users.map((user) => [user.email, user]));
  const changes = [];
  for (const user of imported.users) {
    const current = byEmail.get(user.email) || byObjectId.get(objectIdOf(user));
    if (user.blocked) {
      if (current && (current.status !== 'revoked' || JSON.stringify(store.parsePermissions(current)) !== JSON.stringify(withoutAccess()))) changes.push({ type: 'revoke-blocked', email: user.email, rowKey: current.rowKey, currentStatus: current.status, nextStatus: 'revoked' });
      continue;
    }
    const permissions = policy(user);
    if (!current) changes.push({ type: 'create', email: user.email, permissions });
    else if (current.status !== 'suspended' && current.status !== 'revoked' && (current.displayName !== user.displayName || current.jobTitle !== user.jobTitle || JSON.stringify(store.parsePermissions(current)) !== JSON.stringify(permissions))) changes.push({ type: 'update', email: user.email, rowKey: current.rowKey, permissions });
  }
  const incidents = [];
  for (const current of existing) {
    const email = emailOf(current);
    const linkedUser = objectIdOf(current) ? [...incoming.values()].find((user) => objectIdOf(user) === objectIdOf(current)) : null;
    if (!email) {
      if (!linkedUser) incidents.push({ type: 'unmatched-no-email', rowKey: current.rowKey, staticWebAppsUserId: current.staticWebAppsUserId || '' });
      continue;
    }
    if (!incoming.has(email) && !linkedUser && current.status !== 'revoked') changes.push({ type: 'revoke-absent', email, rowKey: current.rowKey, currentStatus: current.status, nextStatus: 'revoked' });
  }
  const currentAdmins = existing.filter((entity) => entity.status === 'active' && store.parsePermissions(entity).admin === true).map(emailOf);
  const projectedAdmins = new Set(currentAdmins);
  for (const change of changes) {
    if (change.type.startsWith('revoke')) projectedAdmins.delete(change.email);
    if (change.permissions?.admin) projectedAdmins.add(change.email);
    if (change.permissions && !change.permissions.admin) projectedAdmins.delete(change.email);
  }
  if (!projectedAdmins.size) throw new Error('migration-would-remove-last-admin');
  const report = { input, counts: { existing: existing.length, incoming: imported.users.length, changes: changes.length, duplicates: imported.duplicates.length, blocked: imported.users.filter((user) => user.blocked).length, incidents: incidents.length }, duplicates: imported.duplicates, incidents, changes, applied: [] };
  if (!has('--apply')) { console.log(JSON.stringify(report, null, 2)); return; }
  if (!backup) throw new Error('--backup is required with --apply');
  await fs.writeFile(backup, JSON.stringify({ createdAt: new Date().toISOString(), table: process.env.USER_ACCESS_TABLE_NAME || 'NeovantasUserAccess', entities: existing }, null, 2), { encoding: 'utf8', flag: 'wx' });
  for (const change of changes) {
    const user = incoming.get(change.email);
    const current = byEmail.get(change.email);
    if (change.type === 'create') { const created = await store.createEntity(makeEntity(user, change.permissions)); await store.appendAudit({ action: 'census-create', targetRowKey: created.rowKey, actorUserId: 'migration-script', changes: JSON.stringify({ permissions: change.permissions }) }); report.applied.push({ email: change.email, status: 'created' }); continue; }
    const patch = change.type.startsWith('revoke') ? { status: 'revoked', permissions: JSON.stringify(withoutAccess()) } : { displayName: user.displayName, jobTitle: user.jobTitle, entraObjectId: user.entraObjectId || user.objectId || '', permissions: JSON.stringify(change.permissions) };
    const updated = await store.updateEntity(current.rowKey, patch);
    await store.appendAudit({ action: change.type, targetRowKey: updated.rowKey, actorUserId: 'migration-script', changes: JSON.stringify(patch) });
    report.applied.push({ email: change.email, status: 'updated' });
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; });
