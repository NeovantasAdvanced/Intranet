import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAccessToken,
  getMessageDetails,
  listRecentMessagesFromFolder,
  normalizeMailSubject,
  resolveMailFolderId,
  normalizeText,
  loadTextFile,
  sanitizeFolderReference,
} from './outlook-graph-utils.mjs';
import {
  buildNewsParseDebugSnapshot,
  extractNewsItemsFromEmailContent,
  parseNewsEmailContent,
} from './news-parser.mjs';

const outputPath = path.resolve('src/data/news.json');

const rawFolderReference =
  process.env.NEWS_MAIL_FOLDER_RAW ?? process.env.NEWS_MAIL_FOLDER ?? process.env.NEWS_MAIL_FOLDER_NAME ?? '';
const effectiveFolderReference = sanitizeFolderReference(process.env.NEWS_MAIL_FOLDER ?? rawFolderReference);

const config = {
  mailboxUserId: process.env.NEWS_MAILBOX_USER_ID,
  folderName: effectiveFolderReference,
  rawFolderReference,
  folderId: process.env.NEWS_MAIL_FOLDER_ID,
  subjectPrefix: process.env.NEWS_SUBJECT_PREFIX || process.env.NEWS_SUBJECT_CONTAINS || 'Noticias relevantes de hoy',
  sender: process.env.NEWS_SENDER,
  category: process.env.NEWS_CATEGORY ?? 'Comunicacion',
  status: process.env.NEWS_STATUS ?? 'Nuevo',
  source: process.env.NEWS_SOURCE ?? 'Noticias relevantes de hoy',
  lookbackDays: Number(process.env.NEWS_LOOKBACK_DAYS ?? '3'),
  maxItems: Number(process.env.NEWS_MAX_ITEMS ?? '10'),
  htmlFixturePath: process.env.NEWS_HTML_FIXTURE_PATH,
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
  return normalizeMailSubject(stripSubjectPrefix(value));
}

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
    nbsp: ' ',
  };

  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, entity) => named[entity.toLowerCase()] ?? match);
}

function stripTags(html) {
  return decodeHtmlEntities(
    String(html)
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
      .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function extractHtmlFromMht(rawContent) {
  const text = String(rawContent ?? '');
  if (!/Content-Type:\s*multipart\/related/i.test(text) || !/Content-Transfer-Encoding:\s*base64/i.test(text)) {
    return text;
  }

  const lines = text.split(/\r?\n/);
  const contentTypeIndex = lines.findIndex((line) => /Content-Type:\s*text\/html;\s*charset="unicode"/i.test(line));
  if (contentTypeIndex < 0) {
    return text;
  }

  let startIndex = contentTypeIndex + 1;
  while (startIndex < lines.length && lines[startIndex].trim() !== '') {
    startIndex += 1;
  }

  if (startIndex >= lines.length) {
    return text;
  }

  startIndex += 1;
  const payloadLines = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^------=_NextPart_/i.test(line)) {
      break;
    }

    payloadLines.push(line);
  }

  const base64Payload = payloadLines.join('').replace(/\s+/g, '');
  if (!base64Payload) {
    return text;
  }

  try {
    const decoded = Buffer.from(base64Payload, 'base64').toString('utf16le');
    return decoded.includes('<html') ? decoded : text;
  } catch {
    return text;
  }
}

function stripLeadingNewsNumber(value) {
  return String(value ?? '').replace(/^\d+\.\s*/, '').trim();
}

function extractNewsSectionLabel(html) {
  const match = String(html).match(/>\s*([^<()]+)\s*\(\d+\)\s*<\/span>/i);
  return match ? stripTags(match[1]).replace(/\s+/g, ' ').trim() : 'Noticias';
}

function extractNewsCardBlocks(html) {
  const sectionStart = String(html).search(/<span[^>]*>\s*[^<()]+\s*\(\d+\)\s*<\/span>/i);
  const sectionHtml = sectionStart >= 0 ? html.slice(sectionStart) : html;
  const blocks = [];
  const cellRegex = /<td style='padding:11\.25pt 11\.25pt 11\.25pt 11\.25pt'>([\s\S]*?)<\/td>/gi;
  let match;

  while ((match = cellRegex.exec(sectionHtml))) {
    const block = match[1];
    if (/<a\b[^>]*href=["'][^"']+["'][^>]*>\s*<b><span/i.test(block) || /Leer más/i.test(block)) {
      blocks.push(block);
    }
  }

  return blocks;
}

function extractParagraphs(html) {
  const paragraphs = [];
  const paragraphRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = paragraphRegex.exec(html))) {
    paragraphs.push(match[1]);
  }

  return paragraphs;
}

function parseNewsCard(html, sectionLabel, emailDate, index) {
  const paragraphs = extractParagraphs(html);
  if (paragraphs.length < 3) {
    return null;
  }

  const title = stripLeadingNewsNumber(stripTags(paragraphs[0]).replace(/\s+/g, ' ').trim());
  const metaLine = stripTags(paragraphs[1]).replace(/\s+/g, ' ').trim();
  const summary = stripTags(paragraphs[2]).replace(/\s+/g, ' ').trim();
  const hrefMatch = html.match(/<a\b[^>]*href=["']([^"']+)["']/i);
  const href = hrefMatch ? hrefMatch[1] : '';
  const excerpt = summary || 'Resumen no disponible';
  const category = sectionLabel || config.category;
  const normalizedTitle = normalizeText(title);
  const idSeed = [emailDate, sectionLabel, index, title, href, normalizedTitle].filter(Boolean).join('|');

  if (!title || !href) {
    return null;
  }

  return {
    id: `mail-${toDateOnly(emailDate)}-${slugify(idSeed)}`,
    title,
    excerpt,
    category,
    date: toDateOnly(emailDate),
    status: config.status,
    tone: 'info',
    href,
    source: config.source,
  };
}

function parseNewsItemsFromHtml(html, emailDate) {
  const normalizedHtml = extractHtmlFromMht(html);
  const sectionLabel = extractNewsSectionLabel(normalizedHtml);
  const cardBlocks = extractNewsCardBlocks(normalizedHtml);

  return cardBlocks
    .map((cardHtml, index) => parseNewsCard(cardHtml, sectionLabel, emailDate, index))
    .filter(Boolean);
}

async function readExistingNews() {
  const raw = await readFile(outputPath, 'utf8');
  return JSON.parse(raw);
}

async function listNewsMessages(accessToken) {
  const resolvedFolder = await resolveMailFolderId(accessToken, {
    mailboxUserId: config.mailboxUserId,
    folderReference: config.folderName,
    folderId: config.folderId,
    logPrefix: 'Outlook news',
    folderLabel: 'news',
  });

  const messages = await listRecentMessagesFromFolder(
    accessToken,
    config.mailboxUserId,
    resolvedFolder.folderId,
    100,
    undefined,
    {
      sinceIso: getSinceIso(),
    },
  );

  console.log(`[Outlook news] Numero de mensajes recuperados: ${messages.length}`);
  console.log(`[Outlook news] ruta final resuelta: ${resolvedFolder.resolvedPath}`);
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

async function writeNewsDebugArtifacts(normalizedText, parsedEmail) {
  await mkdir(path.resolve('tmp'), { recursive: true });

  await writeFile(path.resolve('tmp/latest-news-email.txt'), `${normalizedText}\n`, 'utf8');
  await writeFile(
    path.resolve('tmp/latest-news-parsed-debug.json'),
    `${JSON.stringify(buildNewsParseDebugSnapshot(parsedEmail), null, 2)}\n`,
    'utf8',
  );
}

function logNewsParseDebug(parsedEmail) {
  const debugSnapshot = buildNewsParseDebugSnapshot(parsedEmail);
  console.log(
    `[Outlook news] normalized preview: ${debugSnapshot.normalizedTextPreview.slice(0, 3000).replace(/\n/g, ' ')}`,
  );
  console.log(
    `[Outlook news] categories detected: ${
      debugSnapshot.categoriesDetected.length > 0
        ? debugSnapshot.categoriesDetected.map((item) => `${item.category} (${item.expectedCount})`).join(' | ')
        : '(none)'
    }`,
  );
  console.log(
    `[Outlook news] links detected: ${debugSnapshot.linksDetected.length > 0 ? debugSnapshot.linksDetected.join(' | ') : '(none)'}`,
  );
  console.log(
    `[Outlook news] numbered lines: ${debugSnapshot.numberedLines.length > 0 ? debugSnapshot.numberedLines.join(' | ') : '(none)'}`,
  );
}

async function main() {
  console.log(`[Outlook news] mailbox usado: ${config.mailboxUserId}`);
  console.log(`[Outlook news] NEWS_MAIL_FOLDER bruto: ${config.rawFolderReference || '(vacío)'}`);
  if (config.folderName) {
    console.log(`[Outlook news] carpeta efectiva: ${config.folderName}`);
  } else {
    console.log('[Outlook news] NEWS_MAIL_FOLDER no está definida; usando fallback inbox.');
  }
  console.log(`[Outlook news] prefijo de asunto: ${config.subjectPrefix}`);

  const existingNews = await readExistingNews();

  let parsedNews = [];
  let parsedEmail = null;

  if (config.htmlFixturePath) {
    const html = await loadTextFile(path.resolve(config.htmlFixturePath));
    console.log(`[Outlook news] Usando fixture local: ${config.htmlFixturePath}`);
    parsedEmail = parseNewsEmailContent(html, {
      subject: '',
      fallbackDateIso: new Date().toISOString(),
      newsletterSource: config.source,
    });
    parsedNews = parsedEmail.items;
  } else {
    if (!config.mailboxUserId) {
      throw new Error('Missing NEWS_MAILBOX_USER_ID. Use the mailbox userPrincipalName or id that receives the news email.');
    }

    const accessToken = await getAccessToken('NEWS', 'NEWS');
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

    const selectedMessageDetails = await getMessageDetails(accessToken, config.mailboxUserId, selectedMessage.id);
    const html = selectedMessageDetails.body?.content ?? selectedMessage.bodyPreview ?? '';
    if (!html) {
      throw new Error(`Selected Outlook message "${selectedMessage.subject}" has no readable HTML body.`);
    }

    parsedEmail = parseNewsEmailContent(html, {
      subject: selectedMessage.subject ?? '',
      fallbackDateIso: selectedMessage.receivedDateTime ?? new Date().toISOString(),
      newsletterSource: config.source,
    });
    parsedNews = parsedEmail.items;
  }

  console.log(
    `[Outlook news] noticias detectadas en el correo: ${parsedNews.length > 0 ? parsedNews.map((item) => item.title).join(' | ') : '(ninguna)'}`,
  );

  if (parsedNews.length === 0) {
    if (parsedEmail) {
      logNewsParseDebug(parsedEmail);
      await writeNewsDebugArtifacts(parsedEmail.normalizedText, parsedEmail);
    }
    throw new Error('No news cards were parsed from the latest Outlook HTML email.');
  }

  const manualNews = existingNews.filter(
    (item) => item.source !== config.source && item.rawMeta?.newsletterSource !== config.source,
  );
  const seenIds = new Set();
  const mergedNews = [...parsedNews, ...manualNews]
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

  console.log(`[Outlook news] numero de noticias extraidas: ${parsedNews.length}`);
  console.log(`Outlook news synced: ${parsedNews.length} mail news, ${mergedNews.length} total news.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export function selectNewsMessageSubjects(messages, subjectPrefix, sender) {
  const wantedPrefix = normalizeMailSubject(subjectPrefix);
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

export function extractNewsItemsFromHtml(html, emailDate = new Date().toISOString()) {
  return extractNewsItemsFromEmailContent(html, { fallbackDateIso: emailDate });
}
