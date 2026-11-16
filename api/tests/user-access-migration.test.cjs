const assert = require('node:assert/strict');
const { planMigration } = require('../scripts/migrate-user-access.cjs');
const { emailRowKey } = require('../_shared/user-access-store.cjs');

const roster = [
  { email: 'employee@neovantas.com', userPrincipalName: 'employee@neovantas.com', displayName: 'Employee' },
  { email: 'repo@neovantas.com', userPrincipalName: 'repo@neovantas.com', displayName: 'Repo' },
  { email: 'employee@neovantas.com', userPrincipalName: 'employee@neovantas.com' },
];
const report = planMigration(roster, [{ rowKey: emailRowKey('existing@neovantas.com'), email: 'existing@neovantas.com', status: 'suspended' }]);
assert.equal(report.detected, 3);
assert.equal(report.prepared, 2);
assert.equal(report.duplicates, 1);
assert.equal(report.existing, 0);
assert.equal(JSON.parse(report.entities[0].permissions).intranet, true);
const rerun = planMigration(roster, [...report.entities, { email: 'existing@neovantas.com', status: 'suspended' }]);
assert.equal(rerun.prepared, 0);
assert.equal(rerun.existing, 2);
console.log('user access migration tests passed');
