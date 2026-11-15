const crypto = require('node:crypto');
const { TableClient } = require('@azure/data-tables');
const organizationUsers = require('../data/organization-users.json');
const usersAccess = require('../data/users-access.json');
const accessControl = require('../data/access-control.json');
const { getPrincipalEmailCandidates, normalizeEmail } = require('./auth.cjs');

const DEFAULT_TABLE_NAME = 'NeovantasUserAccess';
let clientPromise;
let clientKey;
let testClient;

function getConnectionString() {
  return process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || process.env.AZURE_WEBJOBS_STORAGE || '';
}

function getTableName() { return process.env.USER_ACCESS_TABLE_NAME || DEFAULT_TABLE_NAME; }

function identityKey(principal) {
  return `${String(principal?.identityProvider || '').trim().toLowerCase()}:${String(principal?.userId || '').trim()}`;
}

function rowKey(principal) {
  return crypto.createHash('sha256').update(identityKey(principal)).digest('hex');
}

function getRosterEntry(principal) {
  const emails = getPrincipalEmailCandidates(principal);
  return organizationUsers.find((entry) => emails.includes(normalizeEmail(entry.email)) || emails.includes(normalizeEmail(entry.userPrincipalName))) || null;
}

function initialPermissions(email) {
  const normalized = normalizeEmail(email);
  const existing = usersAccess.find((entry) => normalizeEmail(entry.email) === normalized);
  return {
    intranet: false,
    neo: false,
    repositories: accessControl.repositories.allowedEmails.map(normalizeEmail).includes(normalized),
    admin: accessControl.admins.allowedEmails.map(normalizeEmail).includes(normalized) || Boolean(existing?.permissions?.admin),
  };
}

function buildPendingEntity(principal, rosterEntry) {
  const email = normalizeEmail(rosterEntry.email);
  const now = new Date().toISOString();
  return {
    partitionKey: 'users',
    rowKey: rowKey(principal),
    identityProvider: String(principal.identityProvider).trim().toLowerCase(),
    staticWebAppsUserId: String(principal.userId).trim(),
    email,
    userPrincipalName: normalizeEmail(rosterEntry.userPrincipalName || email),
    displayName: rosterEntry.displayName || '',
    status: 'pending',
    permissions: JSON.stringify(initialPermissions(email)),
    requestedAt: now,
    updatedAt: now,
  };
}

async function getClient() {
  if (testClient) return testClient;
  const connectionString = getConnectionString();
  if (!connectionString) throw new Error('user-access-storage-not-configured');
  const key = `${connectionString}:${getTableName()}`;
  if (!clientPromise || clientKey !== key) {
    clientKey = key;
    clientPromise = (async () => {
      const client = TableClient.fromConnectionString(connectionString, getTableName());
      await client.createTable();
      return client;
    })();
  }
  return clientPromise;
}

async function getByPrincipal(principal) {
  return (await getClient()).getEntity('users', rowKey(principal));
}

async function requestAccess(principal) {
  if (!principal?.userId || String(principal.identityProvider).toLowerCase() !== 'aad') return { status: 'not-eligible' };
  const rosterEntry = getRosterEntry(principal);
  if (!rosterEntry) return { status: 'not-in-corporate-roster' };
  const client = await getClient();
  try {
    const current = await getByPrincipal(principal);
    return { status: current.status, entity: current };
  } catch (error) {
    if (error.statusCode !== 404) throw error;
  }
  const entity = buildPendingEntity(principal, rosterEntry);
  await client.createEntity(entity);
  return { status: 'pending', entity };
}

function parsePermissions(entity) {
  try { return JSON.parse(entity.permissions || '{}'); } catch { return {}; }
}

async function listEntities() { return (await getClient()).listEntities().toArray(); }

async function updateEntity(rowKeyValue, patch) {
  const client = await getClient();
  const current = await client.getEntity('users', rowKeyValue);
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await client.updateEntity(next, 'Merge', { etag: current.etag });
  return next;
}

function setUserAccessTableClientForTests(client) { testClient = client; }
function resetUserAccessTableClientForTests() { testClient = undefined; clientPromise = undefined; clientKey = undefined; }

module.exports = { getRosterEntry, initialPermissions, buildPendingEntity, requestAccess, getByPrincipal, listEntities, parsePermissions, updateEntity, setUserAccessTableClientForTests, resetUserAccessTableClientForTests, rowKey };
