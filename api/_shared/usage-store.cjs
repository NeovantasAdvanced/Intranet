const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { TableClient } = require('@azure/data-tables');
const { getPrincipalFromRequest, normalizeEmail } = require('./auth.cjs');

const DEFAULT_TABLE_NAME = 'NeovantasUsageEvents';
const DEFAULT_LOOKBACK_DAYS = 365;

let tableClientPromise;
let fileStorePromise;
let fileWriteQueue = Promise.resolve();

function getConnectionString() {
  return (
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    process.env.AzureWebJobsStorage ||
    process.env.AZURE_WEBJOBS_STORAGE ||
    ''
  );
}

function getTableName() {
  return process.env.USAGE_TABLE_NAME || DEFAULT_TABLE_NAME;
}

async function getTableClient() {
  const connectionString = getConnectionString();
  if (!tableClientPromise) {
    tableClientPromise = (async () => {
      if (!connectionString) {
        return createFileStoreClient();
      }

      const client = TableClient.fromConnectionString(connectionString, getTableName());
      await client.createTableIfNotExists();
      return client;
    })();
  }

  return tableClientPromise;
}

function getLocalStorePath() {
  return process.env.USAGE_STORE_FILE || path.join(os.tmpdir(), 'neovantas-usage-events.json');
}

async function ensureFileStore() {
  if (!fileStorePromise) {
    fileStorePromise = (async () => {
      const filePath = getLocalStorePath();
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      try {
        await fs.access(filePath);
      } catch {
        await fs.writeFile(filePath, '[]', 'utf8');
      }

      return { filePath };
    })();
  }

  return fileStorePromise;
}

async function readFileStoreEntities(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  if (!raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFileStoreEntities(filePath, entities) {
  await fs.writeFile(filePath, `${JSON.stringify(entities, null, 2)}\n`, 'utf8');
}

function createFileStoreClient() {
  return {
    async createTableIfNotExists() {
      await ensureFileStore();
    },
    async createEntity(entity) {
      const { filePath } = await ensureFileStore();
      fileWriteQueue = fileWriteQueue.then(async () => {
        const entities = await readFileStoreEntities(filePath);
        entities.push(entity);
        await writeFileStoreEntities(filePath, entities);
      });
      await fileWriteQueue;
    },
    async *listEntities() {
      const { filePath } = await ensureFileStore();
      const entities = await readFileStoreEntities(filePath);
      for (const entity of entities) {
        yield entity;
      }
    },
  };
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

function getPayloadEmail(payload) {
  const candidates = [payload?.userEmail, payload?.userDetails];
  return candidates
    .map((value) => normalizeEmail(value))
    .find((value) => value.includes('@')) || '';
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
  const userEmail = principal ? getPrincipalEmail(principal) : getPayloadEmail(payload) || 'anonymous@local';
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

  if (principal?.userDetails || payload.userDetails) {
    entity.userDetails = String(principal?.userDetails || payload.userDetails);
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
  const windowStartIso = getWindowStartIso(daysBack);
  const filter = `PartitionKey ge '${windowStartIso}'`;
  const entities = [];

  for await (const entity of client.listEntities({ queryOptions: { filter } })) {
    entities.push(entity);
  }

  return entities.filter((entity) => {
    const entityDay = String(entity.partitionKey || entity.date || '').slice(0, 10);
    return entityDay >= windowStartIso;
  });
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

function getUserLabel(entity) {
  return String(entity.userEmail || entity.userDetails || 'anonymous@local').trim() || 'anonymous@local';
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
  const monthRows = countBy(entities, (entity) => String(entity.date || '').slice(0, 7));
  const usersByEmail = new Map();

  for (const entity of entities) {
    const label = getUserLabel(entity);
    const key = label.toLowerCase();
    const current = usersByEmail.get(key) || {
      label,
      count: 0,
      pageviews: 0,
      sectionViews: 0,
      linkClicks: 0,
      uniqueSections: new Set(),
      uniqueLinks: new Set(),
      lastSeen: '',
    };

    current.count += 1;
    current.lastSeen = current.lastSeen > entity.timestamp ? current.lastSeen : String(entity.timestamp || current.lastSeen);

    if (entity.kind === 'link') {
      current.linkClicks += 1;
      const linkKey = String(entity.href || entity.label || '').trim();
      if (linkKey) {
        current.uniqueLinks.add(linkKey);
      }
    } else if (entity.kind === 'section') {
      current.sectionViews += 1;
      const sectionKey = String(entity.section || '').trim();
      if (sectionKey) {
        current.uniqueSections.add(sectionKey);
      }
    } else {
      current.pageviews += 1;
    }

    usersByEmail.set(key, current);
  }

  const toMetricRow = (row) => ({
    label: row.label,
    count: row.count,
  });

  const userRows = [...usersByEmail.values()]
    .map((user) => ({
      label: user.label,
      count: user.count,
      pageviews: user.pageviews,
      sectionViews: user.sectionViews,
      linkClicks: user.linkClicks,
      uniqueSections: user.uniqueSections.size,
      uniqueLinks: user.uniqueLinks.size,
      lastSeen: user.lastSeen,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'es'));

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
    months: monthRows.map(toMetricRow),
    users: userRows,
    usersByActivity: userRows,
  };
}

function getStorageMode() {
  return getConnectionString() ? 'table' : 'file';
}

module.exports = {
  buildUsageSummary,
  getTableClient,
  listUsageEntities,
  getStorageMode,
  recordUsageEvent,
};
