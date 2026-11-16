const ExcelJS = require('exceljs');
const { normalizeEmail } = require('./auth.cjs');
const { defaultPermissionsForJobTitle, parsePermissions, emailRowKey } = require('./user-access-store.cjs');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const REQUIRED_HEADERS = ['email'];

function text(value) { return String(value ?? '').trim(); }

function normalizeHeader(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function first(row, names) {
  const wanted = names.map(normalizeHeader);
  const key = Object.keys(row).find((candidate) => wanted.includes(normalizeHeader(candidate)));
  return key ? text(row[key]) : '';
}

async function parseWorkbook(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input || '');
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) {
    const error = new Error('invalid-import-file'); error.code = buffer.length > MAX_FILE_BYTES ? 'file-too-large' : 'empty-file'; throw error;
  }
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer); } catch { const error = new Error('invalid-import-file'); error.code = 'invalid-workbook'; throw error; }
  const sheet = workbook.worksheets[0];
  if (!sheet) { const error = new Error('invalid-import-file'); error.code = 'missing-sheet'; throw error; }
  const headerRow = sheet.getRow(1);
  const headers = headerRow.values.slice(1).map((value) => text(value));
  const rows = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const record = {};
    row.values.slice(1).forEach((value, columnIndex) => { record[headers[columnIndex] || `column${columnIndex + 1}`] = text(value); });
    rows.push(record);
  });
  const users = []; const seen = new Set(); const duplicates = [];
  for (const row of rows) {
    const email = normalizeEmail(first(row, ['email', 'user principal name', 'userprincipalname', 'correo']));
    if (!email) continue;
    if (!email.endsWith('@neovantas.com')) continue;
    if (seen.has(email)) { duplicates.push(email); continue; }
    seen.add(email);
    const jobTitle = first(row, ['title', 'job title', 'jobtitle', 'puesto']);
    users.push({ email, displayName: first(row, ['display name', 'displayname', 'name', 'nombre']), jobTitle, objectId: first(row, ['object id', 'objectid', 'entra object id']), blocked: ['true', 'yes', '1', 'blocked'].includes(first(row, ['block credential', 'blockcredential', 'blocked', 'bloqueado']).toLowerCase()), proposedPermissions: defaultPermissionsForJobTitle(jobTitle) });
  }
  return { users, duplicates, rowCount: rows.length };
}

function compareImport(imported, existing) {
  const current = new Map(existing.filter((entity) => entity.partitionKey === 'users').map((entity) => [normalizeEmail(entity.email || entity.userPrincipalName), entity]));
  const incoming = new Set(imported.users.map((user) => user.email));
  const matches = []; const additions = []; const blocked = []; const differences = [];
  for (const user of imported.users) {
    const entity = current.get(user.email);
    if (user.blocked) { blocked.push(user); continue; }
    if (!entity) { additions.push({ ...user, action: 'create' }); continue; }
    const existingPermissions = parsePermissions(entity);
    matches.push({ ...user, rowKey: entity.rowKey, status: entity.status, permissions: existingPermissions, staticWebAppsUserId: entity.staticWebAppsUserId || '' });
    if (text(entity.displayName) !== user.displayName || text(entity.jobTitle) !== user.jobTitle) differences.push({ email: user.email, rowKey: entity.rowKey, existing: { displayName: entity.displayName || '', jobTitle: entity.jobTitle || '' }, incoming: { displayName: user.displayName, jobTitle: user.jobTitle } });
  }
  const absences = existing.filter((entity) => entity.partitionKey === 'users' && entity.email && !incoming.has(normalizeEmail(entity.email))).map((entity) => ({ email: normalizeEmail(entity.email), rowKey: entity.rowKey, status: entity.status }));
  return { matches, additions, absences, differences, blocked, counts: { incoming: imported.users.length, matches: matches.length, additions: additions.length, absences: absences.length, blocked: blocked.length, differences: differences.length } };
}

function makeEntity(user, permissions, now = new Date().toISOString()) {
  return { partitionKey: 'users', rowKey: emailRowKey(user.email), identityProvider: '', staticWebAppsUserId: '', email: user.email, userPrincipalName: user.email, displayName: user.displayName, jobTitle: user.jobTitle, objectId: user.objectId, status: 'active', permissions: JSON.stringify(permissions), importedAt: now, updatedAt: now };
}

module.exports = { MAX_FILE_BYTES, parseWorkbook, compareImport, makeEntity };
