const crypto = require('node:crypto');
const { TableClient } = require('@azure/data-tables');
const { getPrincipalFromRequest, normalizeEmail } = require('./auth.cjs');

const DEFAULT_TABLE_NAME = 'NeovantasUsageEvents';
const DEFAULT_LOOKBACK_DAYS = 365;

let tableClientPromise;

function getConnectionString() {
  return process.env.AZURE_STORAGE_CONNECTION_STRING || '';
}

function getTableName() {
  return process.env.USAGE_TABLE_NAME || DEFAULT_TABLE_NAME;
}

async function getTableClient() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('Missing AZURE_STORAGE_CONNECTION_STRING. Configure Azure Table Storage for usage tracking.');
  }

  if (!tableClientPromise) {
    tableClientPromise = (async () => {
      const client = TableClient.fromConnectionString(connectionString, getTableName());
      await client.createTableIfNotExists();
      return client;
    })();
  }

  return tableClientPromise;
}

function toIsoDay(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function toIsoTimestamp(value) {
  return new Date(value).toISOString();
}

function getWindowStartIso(daysBack = DEFAULT_LOOKBACK_DAYS) {
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - Math.max(1, Number(daysBack) || DEFAULT_LOOKBACK_DAYS));
  windowStart.setUTCHours(0, 0, 0, 0);
  return toIsoDay(windowStart);
}

function getPrincipalEmail(principal) {
  const candidates = [
    principal?.userDetails,
    ...(principal?.claims ?? []).map((claim) => claim?.val ?? ''),
  ];

  return candidates
    .map((value) => normalizeEmail(value))
    .find((value) => value.includes('@')) || 'anonymous@local';
}

function normalizeEventKind(kind) {
  const value = String(kind ?? '').trim().toLowerCase();
  if (value === 'section' || value === 'link' || value === 'pageview') {
    return value;
  }
  return 'pageview';
}

function buildEntityFromPayload(req, payload) {
  const principal = getPrincipalFromRequest(req);
  const now = new Date();
  const timestamp = toIsoTimestamp(payload.timestamp || now);
  const date = toIsoDay(timestamp);
  const kind = normalizeEventKind(payload.kind);
  const userEmail = getPrincipalEmail(principal);
  const section = String(payload.section || payload.page || payload.route || 'Inicio').trim() || 'Inicio';
  const label = String(payload.label || payload.title || section).trim() || section;
  const href = String(payload.href || payload.url || '').trim();
  const route = String(payload.route || '').trim();
  const entity = {
    partitionKey: date,
    rowKey: `${timestamp.replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`,
    timestamp,
    date,
    kind,
    section,
    label,
    href,
    route,
    userEmail,
    userAgent: String(req.headers['user-agent'] || ''),
    referrer: String(req.headers.referer || req.headers.referrer || ''),
  };

  if (principal?.userDetails) {
    entity.userDetails = String(principal.userDetails);
  }

  return entity;
}

async function recordUsageEvent(req, payload) {
  const client = await getTableClient();
  const entity = buildEntityFromPayload(req, payload);
  await client.createEntity(entity);
  return entity;
}

async function listUsageEntities(daysBack = DEFAULT_LOOKBACK_DAYS) {
  const client = await getTableClient();
  const filter = `PartitionKey ge '${getWindowStartIso(daysBack)}'`;
  const entities = [];

  for await (const entity of client.listEntities({ queryOptions: { filter } })) {
    entities.push(entity);
  }

  return entities;
}

function countBy(items, keySelector) {
  const counts = new Map();
  for (const item of items) {
    const key = String(keySelector(item) || '').trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'es'));
}

function buildUsageSummary(entities) {
  const accessesTotal = entities.length;
  const uniqueUsers = new Set(
    entities
      .map((entity) => String(entity.userEmail || entity.userDetails || '').trim().toLowerCase())
      .filter(Boolean),
  ).size;

  const sectionRows = countBy(entities.filter((entity) => entity.kind !== 'link'), (entity) => entity.section);
  const linkRows = countBy(entities.filter((entity) => entity.kind === 'link'), (entity) => entity.label || entity.href);
  const activityByDay = countBy(entities, (entity) => entity.date);
  const activityByUser = countBy(entities, (entity) => entity.userEmail || entity.userDetails);

  const toMetricRow = (row) => ({
    label: row.label,
    count: row.count,
  });

  return {
    totals: {
      accessesTotal,
      uniqueUsers,
    },
    sections: sectionRows.map(toMetricRow),
    topSections: sectionRows.map(toMetricRow),
    links: linkRows.map(toMetricRow),
    topLinks: linkRows.map(toMetricRow),
    activityByDay: activityByDay.map(toMetricRow),
    activityByUser: activityByUser.map(toMetricRow),
  };
}

module.exports = {
  buildUsageSummary,
  getTableClient,
  listUsageEntities,
  recordUsageEvent,
};
