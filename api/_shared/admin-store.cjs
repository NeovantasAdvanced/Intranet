const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { TableClient } = require('@azure/data-tables');
const { normalizeEmail } = require('./auth.cjs');

const DEFAULT_TABLE_NAME = 'NeovantasAdminState';
const DEFAULT_FILE_NAME = 'neovantas-admin-state.json';

let tableClientPromise;
let tableClientKey = '';
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
  return process.env.ADMIN_TABLE_NAME || DEFAULT_TABLE_NAME;
}

function getLocalStorePath() {
  return process.env.ADMIN_STORE_FILE || path.join(os.tmpdir(), DEFAULT_FILE_NAME);
}

function getSeedState() {
  return {
    accessControl: {
      admins: {
        allowedEmails: ['fmacias@neovantas.com'],
      },
      repositories: {
        allowedEmails: ['fmacias@neovantas.com'],
      },
    },
    usersAccess: [
      {
        name: 'Fernando Macías',
        email: 'fmacias@neovantas.com',
        department: 'Advanced Analytics',
        jobTitle: 'Manager',
        permissions: {
          admin: true,
          repositories: true,
        },
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

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

async function ensureFileStore() {
  if (!fileStorePromise) {
    fileStorePromise = (async () => {
      const filePath = getLocalStorePath();
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      try {
        await fs.access(filePath);
      } catch {
        await fs.writeFile(filePath, `${JSON.stringify(getSeedState(), null, 2)}\n`, 'utf8');
      }
      return { filePath };
    })();
  }
  return fileStorePromise;
}

async function readFileStore() {
  const { filePath } = await ensureFileStore();
  const raw = await fs.readFile(filePath, 'utf8');
  if (!raw.trim()) {
    return cloneState(getSeedState());
  }
  try {
    const parsed = JSON.parse(raw);
    return mergeState(parsed);
  } catch {
    return cloneState(getSeedState());
  }
}

async function writeFileStore(state) {
  const { filePath } = await ensureFileStore();
  fileWriteQueue = fileWriteQueue.then(() => fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8'));
  await fileWriteQueue;
}

function mergeEmails(values) {
  return [...new Set((values ?? []).map(normalizeEmail).filter(Boolean))];
}

function mergeUsersAccess(existing, incoming) {
  const rows = Array.isArray(incoming) ? incoming : existing;
  return rows.map((row) => ({
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

function mergeContentArray(existing, incoming) {
  const rows = Array.isArray(incoming) ? incoming : existing;
  return rows.map((row) => ({
    ...row,
    id: String(row.id ?? row.title ?? cryptoRandomId()).trim(),
    title: String(row.title ?? '').trim(),
    description: String(row.description ?? '').trim(),
    href: String(row.href ?? '').trim(),
    category: String(row.category ?? row.group ?? '').trim(),
    visible: row.visible !== false,
  }));
}

function cryptoRandomId() {
  return `item-${Math.random().toString(36).slice(2, 10)}`;
}

function mergeState(state) {
  const seed = getSeedState();
  const payload = state && typeof state === 'object' ? state : {};

  return {
    accessControl: {
      admins: {
        allowedEmails: mergeEmails(payload.accessControl?.admins?.allowedEmails ?? seed.accessControl.admins.allowedEmails),
      },
      repositories: {
        allowedEmails: mergeEmails(payload.accessControl?.repositories?.allowedEmails ?? seed.accessControl.repositories.allowedEmails),
      },
    },
    usersAccess: mergeUsersAccess(seed.usersAccess, payload.usersAccess),
    content: {
      tools: mergeContentArray(seed.content.tools, payload.content?.tools),
      employeeResources: mergeContentArray(seed.content.employeeResources, payload.content?.employeeResources),
      documents: mergeContentArray(seed.content.documents, payload.content?.documents),
      quickLinks: mergeContentArray(seed.content.quickLinks, payload.content?.quickLinks),
    },
  };
}

async function getTableClient() {
  const connectionString = getConnectionString();
  const clientKey = connectionString ? `table:${getTableName()}` : `file:${getLocalStorePath()}`;

  if (tableClientPromise && tableClientKey !== clientKey) {
    tableClientPromise = undefined;
  }

  if (!tableClientPromise) {
    tableClientKey = clientKey;
    tableClientPromise = (async () => {
      if (!connectionString) {
        return {
          async getEntity() {
            return readFileStore();
          },
          async upsertEntity(entity) {
            await writeFileStore(entity);
          },
        };
      }

      const tableClient = TableClient.fromConnectionString(connectionString, getTableName());
      await tableClient.createTable();
      return tableClient;
    })();
  }

  return tableClientPromise;
}

async function readAdminState() {
  const client = await getTableClient();
  if (typeof client.getEntity === 'function') {
    try {
      return mergeState(await client.getEntity('admin', 'state'));
    } catch {
      return cloneState(getSeedState());
    }
  }
  try {
    const entity = await client.getEntity('admin', 'state');
    return mergeState(entity.payload ? JSON.parse(entity.payload) : entity);
  } catch {
    return cloneState(getSeedState());
  }
}

async function writeAdminState(state) {
  const client = await getTableClient();
  const payload = mergeState(state);

  if (typeof client.upsertEntity === 'function') {
    await client.upsertEntity({
      partitionKey: 'admin',
      rowKey: 'state',
      payload: JSON.stringify(payload),
    });
  } else {
    await writeFileStore(payload);
  }

  return payload;
}

module.exports = {
  getSeedState,
  readAdminState,
  writeAdminState,
  mergeState,
};
