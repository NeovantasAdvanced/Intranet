const organizationUsers = require('../data/organization-users.json');
const accessControl = require('../data/access-control.json');
const { buildImportedEntity, emailRowKey, listEntities, getClient } = require('../_shared/user-access-store.cjs');
const { normalizeEmail } = require('../_shared/auth.cjs');

function planMigration(roster = organizationUsers, existing = []) {
  const seen = new Set();
  const report = { detected: roster.length, prepared: 0, existing: 0, duplicates: 0, inconsistencies: [], entities: [] };
  for (const entry of roster) {
    const email = normalizeEmail(entry.email || entry.userPrincipalName);
    if (!email || seen.has(email)) { report.duplicates += 1; continue; }
    seen.add(email);
    const matches = existing.filter((item) => normalizeEmail(item.email || item.userPrincipalName) === email);
    if (matches.length > 1) { report.inconsistencies.push({ email, reason: 'multiple-existing-records' }); continue; }
    if (matches.length === 1) { report.existing += 1; continue; }
    const entity = buildImportedEntity(entry);
    report.prepared += 1;
    report.entities.push(entity);
  }
  return report;
}

async function runMigration({ apply = false } = {}) {
  const existing = await listEntities();
  const report = planMigration(organizationUsers, existing);
  report.mode = apply ? 'apply' : 'dry-run';
  if (apply) {
    const client = await getClient();
    for (const entity of report.entities) await client.createEntity(entity);
  }
  return report;
}

if (require.main === module) {
  runMigration({ apply: process.argv.includes('--apply') })
    .then((report) => { delete report.entities; process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); })
    .catch((error) => { process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`); process.exitCode = 1; });
}

module.exports = { planMigration, runMigration, emailRowKey, accessControl };
