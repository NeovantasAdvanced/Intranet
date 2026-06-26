const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { TableClient } = require('@azure/data-tables');
const { normalizeEmail } = require('./auth.cjs');

const TABLES = {
  accessControl: 'IntranetAccessControl',
  usersAccess: 'IntranetUsersAccess',
  content: 'IntranetManagedContent',
};

const LOCAL_FILE = process.env.ADMIN_STORE_FILE || path.join(os.tmpdir(), 'neovantas-admin-state.json');

let tableClients;
let localStatePromise;
let localWriteQueue = Promise.resolve();

function getConnectionString() {
  return process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || process.env.AZURE_WEBJOBS_STORAGE || '';
}

function getSeedState() {
  return {
    accessControl: {
      admins: { allowedEmails: ['fmacias@neovantas.com'] },
      repositories: { allowedEmails: ['fmacias@neovantas.com'] },
    },
    usersAccess: [
      {
        name: 'Fernando Macías',
        email: 'fmacias@neovantas.com',
        department: 'Advanced Analytics',
        jobTitle: 'Manager',
        permissions: { admin: true, repositories: true },
      },
    ],
    content: {
      tools: [],
      employeeResources: [],
      documents: [],
      quickLinks: [],
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeEmails(values) {
  return [...new Set((values ?? []).map(normalizeEmail).filter(Boolean))];
}

function normalizeUsers(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    name: String(row.name ?? '').trim(),
    email: normalizeEmail(row.email),
    department: String(row.department ?? '').trim(),
    jobTitle: String(row.jobTitle ?? '').trim(),
    permissions: {
      admin: Boolean(row.permissions?.admin),
      repositories: Boolean(row.permissions?.repositories),
    },
  }));
}

function normalizeContent(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    id: String(row.id ?? row.title ?? '').trim(),
    title: String(row.title ?? '').trim(),
    description: String(row.description ?? '').trim(),
    href: String(row.href ?? '').trim(),
    category: String(row.category ?? row.area ?? row.group ?? '').trim(),
    visible: row.visible !== false,
  }));
}

function mergeState(state) {
  const seed = getSeedState();
  const payload = state && typeof state === 'object' ? state : {};
  return {
    accessControl: {
      admins: { allowedEmails: mergeEmails(payload.accessControl?.admins?.allowedEmails ?? seed.accessControl.admins.allowedEmails) },
      repositories: {
        allowedEmails: mergeEmails(payload.accessControl?.repositories?.allowedEmails ?? seed.accessControl.repositories.allowedEmails),
      },
    },
    usersAccess: normalizeUsers(payload.usersAccess ?? seed.usersAccess),
    content: {
      tools: normalizeContent(payload.content?.tools ?? seed.content.tools),
      employeeResources: normalizeContent(payload.content?.employeeResources ?? seed.content.employeeResources),
      documents: normalizeContent(payload.content?.documents ?? seed.content.documents),
      quickLinks: normalizeContent(payload.content?.quickLinks ?? seed.content.quickLinks),
    },
  };
}

async function ensureLocalState() {
  if (!localStatePromise) {
    localStatePromise = (async () => {
      try {
        const raw = await fs.readFile(LOCAL_FILE, 'utf8');
        return raw.trim() ? mergeState(JSON.parse(raw)) : clone(getSeedState());
      } catch {
        const seed = clone(getSeedState());
        await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
        await fs.writeFile(LOCAL_FILE, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
        return seed;
      }
    })();
  }

  return localStatePromise;
}

async function writeLocalState(state) {
  const payload = mergeState(state);
  localWriteQueue = localWriteQueue.then(() => fs.writeFile(LOCAL_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'));
  await localWriteQueue;
  localStatePromise = Promise.resolve(payload);
  return payload;
}

function getTableClients() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return null;
  }

  if (!tableClients) {
    tableClients = {
      accessControl: TableClient.fromConnectionString(connectionString, TABLES.accessControl),
      usersAccess: TableClient.fromConnectionString(connectionString, TABLES.usersAccess),
      content: TableClient.fromConnectionString(connectionString, TABLES.content),
    };
  }

  return tableClients;
}

async function ensureTables() {
  const clients = getTableClients();
  if (!clients) {
    return null;
  }

  const createTable = async (client) => {
    if (typeof client.createTableIfNotExists === 'function') {
      await client.createTableIfNotExists();
      return;
    }

    if (typeof client.createTable === 'function') {
      try {
        await client.createTable();
      } catch (error) {
        if (error?.statusCode === 409 || error?.status === 409) {
          return;
        }
        throw error;
      }
    }
  };

  await createTable(clients.accessControl);
  await createTable(clients.usersAccess);
  await createTable(clients.content);
  return clients;
}

async function upsertEntity(client, entity) {
  if (typeof client.upsertEntity === 'function') {
    await client.upsertEntity(entity, 'Merge');
    return;
  }

  if (typeof client.createEntity === 'function') {
    await client.createEntity(entity);
    return;
  }

  throw new Error('Table client does not support writes.');
}

async function readSingleEntity(client, partitionKey, rowKey) {
  try {
    return await client.getEntity(partitionKey, rowKey);
  } catch {
    return null;
  }
}

async function readAdminState() {
  const clients = await ensureTables();
  if (!clients) {
    return ensureLocalState();
  }

  try {
    const [accessEntity, usersEntity, contentEntity] = await Promise.all([
      readSingleEntity(clients.accessControl, 'admin', 'state'),
      readSingleEntity(clients.usersAccess, 'admin', 'state'),
      readSingleEntity(clients.content, 'admin', 'state'),
    ]);

    const seed = getSeedState();
    return mergeState({
      accessControl: accessEntity?.payload ? JSON.parse(accessEntity.payload) : seed.accessControl,
      usersAccess: usersEntity?.payload ? JSON.parse(usersEntity.payload) : seed.usersAccess,
      content: contentEntity?.payload ? JSON.parse(contentEntity.payload) : seed.content,
    });
  } catch (error) {
    console.error('[admin-store] read failed', error?.message || error);
    return ensureLocalState();
  }
}

async function writeAdminState(state) {
  const payload = mergeState(state);
  const clients = await ensureTables();

  if (!clients) {
    return writeLocalState(payload);
  }

  try {
    await Promise.all([
      upsertEntity(clients.accessControl, {
        partitionKey: 'admin',
        rowKey: 'state',
        payload: JSON.stringify(payload.accessControl),
      }),
      upsertEntity(clients.usersAccess, {
        partitionKey: 'admin',
        rowKey: 'state',
        payload: JSON.stringify(payload.usersAccess),
      }),
      upsertEntity(clients.content, {
        partitionKey: 'admin',
        rowKey: 'state',
        payload: JSON.stringify(payload.content),
      }),
    ]);
  } catch (error) {
    console.error('[admin-store] write failed', error?.message || error);
    throw error;
  }

  return payload;
}

module.exports = {
  getSeedState,
  readAdminState,
  writeAdminState,
  mergeState,
};
