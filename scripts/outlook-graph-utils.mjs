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

export function splitFolderReference(value) {
  return String(value ?? '')
    .trim()
    .replace(/[\\]+/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function isInboxLikeFolderName(value) {
  const normalized = normalizeText(value);
  return normalized === 'inbox' || normalized === 'bandeja de entrada';
}

export function sanitizeFolderReference(value) {
  const raw = String(value ?? '')
    .trim()
    .replace(/[\\]+/g, '/')
    .replace(/\s+/g, ' ');

  if (!raw) {
    return '';
  }

  const withoutLeadingSlash = raw.replace(/^\/+/, '');
  if (/^mailfolders\/inbox\/childfolders\/?$/i.test(withoutLeadingSlash)) {
    return '';
  }

  if (/^mailfolders\//i.test(withoutLeadingSlash)) {
    return withoutLeadingSlash.replace(/^mailfolders\//i, '');
  }

  return withoutLeadingSlash;
}

export function sameFolderName(left, right) {
  return normalizeText(left) === normalizeText(right);
}

export function folderPathLabel(segments) {
  return segments.filter(Boolean).join('/');
}

export function formatFolderList(folders, prefix = '- ') {
  return folders
    .map((folder) => `${prefix}${folder.displayName ?? '(sin nombre)'} (${folder.id ?? 'sin id'})`)
    .join('\n');
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

export async function graphRawRequest(accessToken, url) {
  const requestUrl = url.startsWith('https://') ? url : `${graphBaseUrl}${url}`;
  const response = await fetch(requestUrl, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: '*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Graph request failed: ${response.status} ${await response.text()}`);
  }

  return response.text();
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
  return formatFolderList(folders);
}

export async function loadTextFile(filePath) {
  return readFile(filePath, 'utf8');
}

export function normalizeMailSubject(value) {
  return normalizeText(String(value ?? '').replace(/^(re|fw|fwd):\s*/i, '').trim());
}

export async function listRecentMessagesFromFolder(accessToken, mailboxUserId, folderId, limit = 20, selectFields = [
  'id',
  'internetMessageId',
  'subject',
  'bodyPreview',
  'receivedDateTime',
  'from',
  'webLink',
]) {
  const select = selectFields.join(',');
  const messages = await graphCollection(
    accessToken,
    `/users/${encodeURIComponent(mailboxUserId)}/mailFolders/${encodeURIComponent(folderId)}/messages?$select=${select}&$top=100`,
    Math.max(1, limit),
  );

  return messages.slice(0, limit);
}

export async function getMessageAttachments(accessToken, mailboxUserId, messageId, selectFields = [
  'id',
  'name',
  'contentType',
  'size',
  'isInline',
]) {
  const select = selectFields.join(',');
  return graphCollection(
    accessToken,
    `/users/${encodeURIComponent(mailboxUserId)}/messages/${encodeURIComponent(messageId)}/attachments?$select=${select}`,
    50,
  );
}

export function downloadAttachmentContent(attachment) {
  if (!attachment?.contentBytes) {
    return '';
  }

  return Buffer.from(attachment.contentBytes, 'base64').toString('utf8');
}

export async function downloadAttachmentValue(accessToken, mailboxUserId, messageId, attachmentId) {
  return graphRequest(
    accessToken,
    `/users/${encodeURIComponent(mailboxUserId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
}

export async function listRootMailFolders(accessToken, mailboxUserId) {
  return graphCollection(accessToken, `/users/${encodeURIComponent(mailboxUserId)}/mailFolders?$top=100`, 100);
}

export async function listChildMailFolders(accessToken, mailboxUserId, folderId) {
  return graphCollection(
    accessToken,
    `/users/${encodeURIComponent(mailboxUserId)}/mailFolders/${encodeURIComponent(folderId)}/childFolders?$top=100`,
    100,
  );
}

export async function resolveMailFolderId(accessToken, options) {
  const {
    mailboxUserId,
    folderReference,
    folderId,
    logPrefix,
    folderLabel = 'carpeta',
    maxDepth = 3,
  } = options;

  const requested = sanitizeFolderReference(folderReference);
  const effectiveReference = requested || 'inbox';

  if (folderId) {
    console.log(`[${logPrefix}] mailbox: ${mailboxUserId}`);
    console.log(`[${logPrefix}] carpeta solicitada: ${effectiveReference}`);
    console.log(`[${logPrefix}] ruta resuelta: ${effectiveReference}`);
    console.log(`[${logPrefix}] folderId final: ${folderId}`);
    return {
      folderId,
      resolvedPath: effectiveReference,
      rootFolders: [],
      inboxChildFolders: [],
    };
  }

  if (!mailboxUserId) {
    throw new Error(`Missing ${folderLabel.toUpperCase()}_MAILBOX_USER_ID. Use the mailbox userPrincipalName or id that receives the mail.`);
  }

  console.log(`[${logPrefix}] mailbox: ${mailboxUserId}`);
  console.log(`[${logPrefix}] carpeta solicitada: ${effectiveReference}`);

  const rootFolders = await listRootMailFolders(accessToken, mailboxUserId);
  const inboxChildFolders = await listChildMailFolders(accessToken, mailboxUserId, 'inbox');
  console.log(
    `[${logPrefix}] subcarpetas encontradas dentro de inbox: ${
      inboxChildFolders.length > 0
        ? inboxChildFolders.map((folder) => folder.displayName ?? '(sin nombre)').join(' | ')
        : '(ninguna)'
    }`,
  );

  if (isInboxLikeFolderName(effectiveReference)) {
    console.log(`[${logPrefix}] se usa well-known folder inbox`);
    console.log(`[${logPrefix}] ruta resuelta: inbox`);
    console.log(`[${logPrefix}] folderId final: inbox`);
    return {
      folderId: 'inbox',
      resolvedPath: 'inbox',
      rootFolders,
      inboxChildFolders,
    };
  }

  const rootExactMatch = rootFolders.find((folder) => sameFolderName(folder.displayName, effectiveReference));
  if (rootExactMatch?.id) {
    const resolvedPath = rootExactMatch.displayName ?? effectiveReference;
    console.log(`[${logPrefix}] ruta resuelta: ${resolvedPath}`);
    console.log(`[${logPrefix}] folderId final: ${rootExactMatch.id}`);
    return {
      folderId: rootExactMatch.id,
      resolvedPath,
      rootFolders,
      inboxChildFolders,
    };
  }

  const pathSegments = splitFolderReference(effectiveReference);
  const wantsInboxPath = pathSegments.length > 1 && isInboxLikeFolderName(pathSegments[0]);

  if (wantsInboxPath) {
    console.log(`[${logPrefix}] se usa well-known folder inbox`);
    const pathResolution = await resolveNestedFolderPath(accessToken, mailboxUserId, pathSegments.slice(1), 'inbox', 'Bandeja de entrada', logPrefix);
    if (pathResolution) {
      return {
        folderId: pathResolution.folderId,
        resolvedPath: pathResolution.resolvedPath,
        rootFolders,
        inboxChildFolders,
      };
    }
  }

  const inboxRootMatch = inboxChildFolders.find((folder) => sameFolderName(folder.displayName, effectiveReference));
  if (inboxRootMatch?.id) {
    const resolvedPath = folderPathLabel(['Bandeja de entrada', inboxRootMatch.displayName ?? effectiveReference]);
    console.log(`[${logPrefix}] ruta resuelta: ${resolvedPath}`);
    console.log(`[${logPrefix}] folderId final: ${inboxRootMatch.id}`);
    return {
      folderId: inboxRootMatch.id,
      resolvedPath,
      rootFolders,
      inboxChildFolders,
    };
  }

  const recursiveMatch = await searchFolderTree(accessToken, mailboxUserId, effectiveReference, rootFolders, inboxChildFolders, maxDepth, logPrefix);
  if (recursiveMatch) {
    return {
      folderId: recursiveMatch.folderId,
      resolvedPath: recursiveMatch.resolvedPath,
      rootFolders,
      inboxChildFolders,
    };
  }

  throw new Error(
    [
      `${folderLabel.toUpperCase()} folder "${effectiveReference}" not found for mailbox ${mailboxUserId}.`,
      'Available root folders:',
      formatFolderList(rootFolders) || '- (sin carpetas encontradas)',
      'Available inbox child folders:',
      formatFolderList(inboxChildFolders) || '- (sin subcarpetas encontradas)',
      `Recommendation: set ${folderLabel.toUpperCase()}_MAIL_FOLDER=inbox/Neovantas`,
      `Fallback: set ${folderLabel.toUpperCase()}_MAIL_FOLDER_ID with the exact folder id if you prefer.`,
    ].join('\n'),
  );
}

async function resolveNestedFolderPath(accessToken, mailboxUserId, segments, folderId, resolvedPath, logPrefix) {
  let currentFolderId = folderId;
  let currentPath = resolvedPath;

  for (const segment of segments) {
    if (!segment) {
      continue;
    }

    const childFolders = await listChildMailFolders(accessToken, mailboxUserId, currentFolderId);
    const match = childFolders.find((folder) => sameFolderName(folder.displayName, segment));
    if (!match?.id) {
      console.log(
        `[${logPrefix}] subcarpetas en ${currentPath}: ${
          childFolders.length > 0 ? childFolders.map((folder) => folder.displayName ?? '(sin nombre)').join(' | ') : '(ninguna)'
        }`,
      );
      return null;
    }

    currentFolderId = match.id;
    currentPath = folderPathLabel([currentPath, match.displayName ?? segment]);
  }

  console.log(`[${logPrefix}] ruta resuelta: ${currentPath}`);
  console.log(`[${logPrefix}] folderId final: ${currentFolderId}`);
  return { folderId: currentFolderId, resolvedPath: currentPath };
}

async function searchFolderTree(accessToken, mailboxUserId, folderName, rootFolders, inboxChildFolders, maxDepth, logPrefix) {
  const normalizedTarget = normalizeText(folderName);
  const initialNodes = [
    ...rootFolders.map((folder) => ({
      folderId: folder.id,
      displayName: folder.displayName ?? '',
      path: folder.displayName ?? '',
      depth: 1,
    })),
    ...inboxChildFolders.map((folder) => ({
      folderId: folder.id,
      displayName: folder.displayName ?? '',
      path: folderPathLabel(['Bandeja de entrada', folder.displayName ?? '']),
      depth: 1,
    })),
  ];

  const queue = [...initialNodes];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.folderId)) {
      continue;
    }

    visited.add(current.folderId);

    if (sameFolderName(current.displayName, folderName)) {
      console.log(`[${logPrefix}] ruta resuelta: ${current.path}`);
      console.log(`[${logPrefix}] folderId final: ${current.folderId}`);
      return { folderId: current.folderId, resolvedPath: current.path };
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    const childFolders = await listChildMailFolders(accessToken, mailboxUserId, current.folderId);
    for (const child of childFolders) {
      queue.push({
        folderId: child.id,
        displayName: child.displayName ?? '',
        path: folderPathLabel([current.path, child.displayName ?? '']),
        depth: current.depth + 1,
      });
    }
  }

  if (normalizedTarget === 'neovantas') {
    const inboxDeepMatch = await searchInInboxDepth(accessToken, mailboxUserId, inboxChildFolders, maxDepth, logPrefix);
    if (inboxDeepMatch) {
      return inboxDeepMatch;
    }
  }

  return null;
}

async function searchInInboxDepth(accessToken, mailboxUserId, inboxChildFolders, maxDepth, logPrefix) {
  const queue = inboxChildFolders.map((folder) => ({
    folderId: folder.id,
    displayName: folder.displayName ?? '',
    path: folderPathLabel(['Bandeja de entrada', folder.displayName ?? '']),
    depth: 1,
  }));
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.folderId)) {
      continue;
    }

    visited.add(current.folderId);

    if (sameFolderName(current.displayName, 'Neovantas')) {
      console.log(`[${logPrefix}] ruta resuelta: ${current.path}`);
      console.log(`[${logPrefix}] folderId final: ${current.folderId}`);
      return { folderId: current.folderId, resolvedPath: current.path };
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    const childFolders = await listChildMailFolders(accessToken, mailboxUserId, current.folderId);
    for (const child of childFolders) {
      queue.push({
        folderId: child.id,
        displayName: child.displayName ?? '',
        path: folderPathLabel([current.path, child.displayName ?? '']),
        depth: current.depth + 1,
      });
    }
  }

  return null;
}
