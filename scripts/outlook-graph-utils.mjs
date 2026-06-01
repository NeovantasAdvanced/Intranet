import { readFile } from 'node:fs/promises';

const graphBaseUrl = 'https://graph.microsoft.com/v1.0';

export function readEnv(...names) {
  return names.map((name) => process.env[name]).find(Boolean);
}

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

export async function getAccessToken(prefix, credentialPrefix) {
  const existingToken = readEnv('GRAPH_ACCESS_TOKEN', 'MS_GRAPH_ACCESS_TOKEN');

  if (existingToken) {
    return existingToken;
  }

  const tenantId = readEnv(
    `${credentialPrefix}_TENANT_ID`,
    `${prefix}_TENANT_ID`,
    'SHAREPOINT_TENANT_ID',
    'AZURE_TENANT_ID',
    'TENANT_ID',
  );
  const clientId = readEnv(
    `${credentialPrefix}_CLIENT_ID`,
    `${prefix}_CLIENT_ID`,
    'SHAREPOINT_CLIENT_ID',
    'AZURE_CLIENT_ID',
    'CLIENT_ID',
  );
  const clientSecret = readEnv(
    `${credentialPrefix}_CLIENT_SECRET`,
    `${prefix}_CLIENT_SECRET`,
    'SHAREPOINT_CLIENT_SECRET',
    'AZURE_CLIENT_SECRET',
    'CLIENT_SECRET',
  );

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      `Missing Graph credentials. Set ${prefix}_TENANT_ID, ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET, or reuse SHAREPOINT_* secrets.`,
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default',
  });

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Graph auth failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return payload.access_token;
}

export async function graphRequest(accessToken, url) {
  const requestUrl = url.startsWith('https://') ? url : `${graphBaseUrl}${url}`;
  const response = await fetch(requestUrl, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Graph request failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

export async function graphCollection(accessToken, url, limit = 200) {
  const items = [];
  let nextUrl = url;

  while (nextUrl && items.length < limit) {
    const payload = await graphRequest(accessToken, nextUrl);
    items.push(...(payload.value ?? []));
    nextUrl = payload['@odata.nextLink'];
  }

  return items;
}

export function folderListText(folders) {
  return folders
    .map((folder) => `- ${folder.displayName ?? '(sin nombre)'} (${folder.id ?? 'sin id'})`)
    .join('\n');
}

export async function loadTextFile(filePath) {
  return readFile(filePath, 'utf8');
}
