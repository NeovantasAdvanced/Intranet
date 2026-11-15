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

function emailRowKey(email) {
  return `email-${crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex')}`;
}

function getRosterEntry(principal) {
  const emails = getPrincipalEmailCandidates(principal);
  return organizationUsers.find((entry) => emails.includes(normalizeEmail(entry.email)) || emails.includes(normalizeEmail(entry.userPrincipalName))) || null;
}

function initialPermissions(email) {
  const normalized = normalizeEmail(email);
  const existing = usersAccess.find((entry) => normalizeEmail(entry.email) === normalized);
  return {
    intranet: true,
    neo: accessControl.admins.allowedEmails.map(normalizeEmail).includes(normalized) || Boolean(existing?.permissions?.neo),
    repositories: accessControl.repositories.allowedEmails.map(normalizeEmail).includes(normalized),
    admin: accessControl.admins.allowedEmails.map(normalizeEmail).includes(normalized) || Boolean(existing?.permissions?.admin),
  };
}

function buildImportedEntity(rosterEntry) {
  const email = normalizeEmail(rosterEntry.email || rosterEntry.userPrincipalName);
  const now = new Date().toISOString();
  return {
    partitionKey: 'users',
    rowKey: emailRowKey(email),
    identityProvider: '',
    staticWebAppsUserId: '',
    email,
    userPrincipalName: normalizeEmail(rosterEntry.userPrincipalName || email),
    displayName: rosterEntry.displayName || '',
    status: 'active',
    permissions: JSON.stringify(initialPermissions(email)),
    importedAt: now,
    updatedAt: now,
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
  const client = await getClient();
  try { return await client.getEntity('users', rowKey(principal)); } catch (error) {
    if (error.statusCode !== 404) throw error;
    const emailSet = new Set(getPrincipalEmailCandidates(principal).map(normalizeEmail));
    const matches = (await client.listEntities().toArray()).filter((entity) => emailSet.has(normalizeEmail(entity.email)) || emailSet.has(normalizeEmail(entity.userPrincipalName)));
    if (matches.length > 1) { const conflict = new Error('user-access-identity-conflict'); conflict.statusCode = 409; throw conflict; }
    if (matches.length === 1) return matches[0];
    throw error;
  }
}

async function linkPrincipal(principal) {
  if (!principal?.userId || String(principal.identityProvider).toLowerCase() !== 'aad') return { status: 'not-eligible' };
  let current;
  try { current = await getByPrincipal(principal); } catch (error) {
    if (error.statusCode === 404) return { status: getRosterEntry(principal) ? 'not-registered' : 'not-in-corporate-roster' };
    throw error;
  }
  const principalEmails = new Set(getPrincipalEmailCandidates(principal).map(normalizeEmail));
  const recordEmails = [current.email, current.userPrincipalName].map(normalizeEmail).filter(Boolean);
  if (!recordEmails.some((email) => principalEmails.has(email))) return { status: 'identity-mismatch', entity: current };
  if (String(current.staticWebAppsUserId || '').trim() && String(current.staticWebAppsUserId).trim() !== String(principal.userId).trim()) return { status: 'identity-mismatch', entity: current };
  if (String(current.identityProvider || '').trim() && String(current.identityProvider).trim().toLowerCase() !== 'aad') return { status: 'identity-mismatch', entity: current };
  if (String(current.status).toLowerCase() === 'suspended' || String(current.status).toLowerCase() === 'revoked') return { status: current.status, entity: current };
  if (!current.staticWebAppsUserId) {
    current = await updateEntity(current.rowKey, { identityProvider: 'aad', staticWebAppsUserId: String(principal.userId).trim() });
  }
  return { status: current.status, entity: current };
}

async function requestAccess(principal) {
  if (!principal?.userId || String(principal.identityProvider).toLowerCase() !== 'aad') return { status: 'not-eligible' };
  return linkPrincipal(principal);
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

module.exports = { getRosterEntry, initialPermissions, buildPendingEntity, buildImportedEntity, emailRowKey, requestAccess, linkPrincipal, getByPrincipal, listEntities, parsePermissions, updateEntity, getClient, setUserAccessTableClientForTests, resetUserAccessTableClientForTests, rowKey };
