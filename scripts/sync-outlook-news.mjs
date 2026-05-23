import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const graphBaseUrl = 'https://graph.microsoft.com/v1.0';
const outputPath = path.resolve('src/data/news.json');

const config = {
  mailboxUserId: process.env.NEWS_MAILBOX_USER_ID,
  folderId: process.env.NEWS_MAIL_FOLDER_ID ?? 'inbox',
  sender: process.env.NEWS_SENDER,
  subjectContains: process.env.NEWS_SUBJECT_CONTAINS,
  category: process.env.NEWS_CATEGORY ?? 'Comunicacion',
  status: process.env.NEWS_STATUS ?? 'Nuevo',
  source: process.env.NEWS_SOURCE ?? 'Outlook',
  allowUnfilteredInbox: process.env.NEWS_ALLOW_UNFILTERED_INBOX === 'true',
  lookbackDays: Number(process.env.NEWS_LOOKBACK_DAYS ?? '14'),
  maxItems: Number(process.env.NEWS_MAX_ITEMS ?? '10'),
};

function readEnv(...names) {
  return names.map((name) => process.env[name]).find(Boolean);
}

function normalizeSearch(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(value) {
  const slug = normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'noticia';
}

function stripSubjectPrefix(subject) {
  return subject.replace(/^(re|fw|fwd):\s*/i, '').trim();
}

function cleanPreview(value) {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^This message originated outside.*?$/i, '')
    .trim()
    .slice(0, 220);
}

function toDateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function getSinceIso() {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - config.lookbackDays);
  since.setUTCHours(0, 0, 0, 0);
  return since.toISOString();
}

async function getAccessToken() {
  const existingToken = readEnv('GRAPH_ACCESS_TOKEN', 'MS_GRAPH_ACCESS_TOKEN');

  if (existingToken) {
    return existingToken;
  }

  const tenantId = readEnv('NEWS_TENANT_ID', 'SHAREPOINT_TENANT_ID', 'AZURE_TENANT_ID', 'TENANT_ID');
  const clientId = readEnv('NEWS_CLIENT_ID', 'SHAREPOINT_CLIENT_ID', 'AZURE_CLIENT_ID', 'CLIENT_ID');
  const clientSecret = readEnv('NEWS_CLIENT_SECRET', 'SHAREPOINT_CLIENT_SECRET', 'AZURE_CLIENT_SECRET', 'CLIENT_SECRET');

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Graph credentials. Set NEWS_TENANT_ID, NEWS_CLIENT_ID and NEWS_CLIENT_SECRET, or reuse SHAREPOINT_* secrets.',
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

async function graphRequest(accessToken, url) {
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

async function graphCollection(accessToken, url) {
  const items = [];
  let nextUrl = url;

  while (nextUrl && items.length < config.maxItems * 4) {
    const payload = await graphRequest(accessToken, nextUrl);
    items.push(...(payload.value ?? []));
    nextUrl = payload['@odata.nextLink'];
  }

  return items;
}

function messageMatches(message) {
  const sender = message.from?.emailAddress?.address ?? '';
  const subject = message.subject ?? '';

  if (config.sender && normalizeSearch(sender) !== normalizeSearch(config.sender)) {
    return false;
  }

  if (config.subjectContains && !normalizeSearch(subject).includes(normalizeSearch(config.subjectContains))) {
    return false;
  }

  return true;
}

function toNewsItem(message) {
  const title = stripSubjectPrefix(message.subject ?? 'Noticia sin asunto');
  const receivedAt = message.receivedDateTime ?? new Date().toISOString();

  return {
    id: `mail-${toDateOnly(receivedAt)}-${slugify(message.internetMessageId ?? message.id ?? title)}`,
    title,
    excerpt: cleanPreview(message.bodyPreview) || 'Correo recibido para publicar en la intranet.',
    category: config.category,
    date: toDateOnly(receivedAt),
    status: config.status,
    tone: 'info',
    href: message.webLink,
    source: config.source,
  };
}

async function readExistingNews() {
  const raw = await readFile(outputPath, 'utf8');
  return JSON.parse(raw);
}

async function listNewsMessages(accessToken) {
  if (!config.mailboxUserId) {
    throw new Error('Missing NEWS_MAILBOX_USER_ID. Use the mailbox userPrincipalName or id that receives the news email.');
  }

  if (
    normalizeSearch(config.folderId) === 'inbox' &&
    !config.sender &&
    !config.subjectContains &&
    !config.allowUnfilteredInbox
  ) {
    throw new Error(
      'Refusing to import the full inbox. Set NEWS_SENDER, NEWS_SUBJECT_CONTAINS, NEWS_MAIL_FOLDER_ID, or NEWS_ALLOW_UNFILTERED_INBOX=true.',
    );
  }

  const select = [
    'id',
    'internetMessageId',
    'subject',
    'bodyPreview',
    'receivedDateTime',
    'from',
    'webLink',
  ].join(',');
  const filter = encodeURIComponent(`receivedDateTime ge ${getSinceIso()}`);
  const orderBy = encodeURIComponent('receivedDateTime desc');
  const url = `/users/${encodeURIComponent(config.mailboxUserId)}/mailFolders/${encodeURIComponent(config.folderId)}/messages?$select=${select}&$filter=${filter}&$orderby=${orderBy}&$top=50`;

  return graphCollection(accessToken, url);
}

async function main() {
  const accessToken = await getAccessToken();
  const existingNews = await readExistingNews();
  const messages = await listNewsMessages(accessToken);
  const mailNews = messages
    .filter(messageMatches)
    .slice(0, config.maxItems)
    .map(toNewsItem);

  const manualNews = existingNews.filter((item) => item.source !== config.source);
  const seenIds = new Set();
  const mergedNews = [...mailNews, ...manualNews]
    .filter((item) => {
      if (seenIds.has(item.id)) {
        return false;
      }

      seenIds.add(item.id);
      return true;
    })
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, Math.max(config.maxItems, 10));

  await writeFile(outputPath, `${JSON.stringify(mergedNews, null, 2)}\n`, 'utf8');

  console.log(`Outlook news synced: ${mailNews.length} mail news, ${mergedNews.length} total news.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
