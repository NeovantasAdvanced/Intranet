import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  folderListText,
  getAccessToken,
  graphCollection,
  normalizeText,
  readEnv,
} from './outlook-graph-utils.mjs';

const outputPath = path.resolve('src/data/news.json');

const config = {
  mailboxUserId: process.env.NEWS_MAILBOX_USER_ID,
  folderName: process.env.NEWS_MAIL_FOLDER || process.env.NEWS_MAIL_FOLDER_NAME,
  subjectPrefix: process.env.NEWS_SUBJECT_PREFIX || process.env.NEWS_SUBJECT_CONTAINS || 'Noticias relevantes de hoy',
  sender: process.env.NEWS_SENDER,
  category: process.env.NEWS_CATEGORY ?? 'Comunicacion',
  status: process.env.NEWS_STATUS ?? 'Nuevo',
  source: process.env.NEWS_SOURCE ?? 'Noticias relevantes de hoy',
  lookbackDays: Number(process.env.NEWS_LOOKBACK_DAYS ?? '14'),
  maxItems: Number(process.env.NEWS_MAX_ITEMS ?? '10'),
};

function slugify(value) {
  const slug = normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'noticia';
}

function stripSubjectPrefix(subject) {
  return String(subject ?? '').replace(/^(re|fw|fwd):\s*/i, '').trim();
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

function normalizeSubject(value) {
  return normalizeText(stripSubjectPrefix(value));
}

async function readExistingNews() {
  const raw = await readFile(outputPath, 'utf8');
  return JSON.parse(raw);
}

async function resolveMailFolder(accessToken) {
  if (config.folderName) {
    console.log(`[Outlook news] mailbox: ${config.mailboxUserId}`);
    console.log(`[Outlook news] carpeta solicitada: ${config.folderName}`);
    const folders = await graphCollection(
      accessToken,
      `/users/${encodeURIComponent(config.mailboxUserId)}/mailFolders?$top=100`,
      100,
    );
    const folder = folders.find((item) => item.displayName === config.folderName);

    if (!folder?.id) {
      throw new Error(
        `NEWS_MAIL_FOLDER "${config.folderName}" not found for mailbox ${config.mailboxUserId}.\nAvailable folders:\n${folderListText(folders) || '- (sin carpetas encontradas)'}`,
      );
    }

    console.log(`[Outlook news] folderId encontrado: ${folder.id}`);
    return folder.id;
  }

  console.log(`[Outlook news] mailbox: ${config.mailboxUserId}`);
  console.log('[Outlook news] carpeta solicitada: inbox');
  console.log('[Outlook news] folderId encontrado: inbox');
  return 'inbox';
}

async function listNewsMessages(accessToken) {
  if (!config.mailboxUserId) {
    throw new Error('Missing NEWS_MAILBOX_USER_ID. Use the mailbox userPrincipalName or id that receives the news email.');
  }

  const folderId = await resolveMailFolder(accessToken);
  const select = ['id', 'internetMessageId', 'subject', 'bodyPreview', 'receivedDateTime', 'from', 'webLink'].join(',');
  const url = `/users/${encodeURIComponent(config.mailboxUserId)}/mailFolders/${encodeURIComponent(folderId)}/messages?$select=${select}&$top=100`;
  const messages = await graphCollection(accessToken, url, 100);

  console.log(`[Outlook news] Numero de mensajes recuperados: ${messages.length}`);
  return messages;
}

function messageMatches(message) {
  const sender = normalizeText(message.from?.emailAddress?.address ?? '');
  const subject = normalizeSubject(message.subject ?? '');
  const prefix = normalizeText(config.subjectPrefix);

  if (config.sender && sender !== normalizeText(config.sender)) {
    return false;
  }

  return subject.startsWith(prefix) || subject.includes(prefix);
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

async function main() {
  const accessToken = await getAccessToken('NEWS', 'NEWS');
  const existingNews = await readExistingNews();
  const messages = await listNewsMessages(accessToken);

  const candidateMessages = messages
    .filter(messageMatches)
    .sort((left, right) => new Date(right.receivedDateTime ?? 0).getTime() - new Date(left.receivedDateTime ?? 0).getTime());

  console.log(
    `[Outlook news] asuntos candidatos detectados: ${
      candidateMessages.length > 0 ? candidateMessages.map((message) => message.subject).join(' | ') : '(ninguno)'
    }`,
  );

  if (candidateMessages.length === 0) {
    throw new Error(
      `No Outlook message found in folder "${config.folderName ?? 'inbox'}" matching prefix "${config.subjectPrefix}".`,
    );
  }

  const selectedMessage = candidateMessages[0];
  console.log(`[Outlook news] asunto seleccionado: ${selectedMessage.subject}`);

  const mailNews = [selectedMessage].map(toNewsItem);
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

  console.log(`[Outlook news] numero de noticias extraidas: ${mailNews.length}`);
  console.log(`Outlook news synced: ${mailNews.length} mail news, ${mergedNews.length} total news.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export function selectNewsMessageSubjects(messages, subjectPrefix, sender) {
  const wantedPrefix = normalizeText(subjectPrefix);
  const wantedSender = sender ? normalizeText(sender) : '';

  return messages
    .filter((message) => {
      const subject = normalizeSubject(message.subject ?? '');
      const from = normalizeText(message.from?.emailAddress?.address ?? '');

      if (wantedSender && from !== wantedSender) {
        return false;
      }

      return subject.startsWith(wantedPrefix) || subject.includes(wantedPrefix);
    })
    .sort((left, right) => new Date(right.receivedDateTime ?? 0).getTime() - new Date(left.receivedDateTime ?? 0).getTime());
}
