import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const graphBaseUrl = 'https://graph.microsoft.com/v1.0';
const outputPath = path.resolve('src/data/events.json');

const config = {
  mailboxUserId:
    process.env.EVENTS_MAILBOX_USER_ID ||
    process.env.NEWS_MAILBOX_USER_ID ||
    process.env.SHAREPOINT_MAILBOX_USER_ID,
  folderId: process.env.EVENTS_MAIL_FOLDER_ID,
  folderName: process.env.EVENTS_MAIL_FOLDER || process.env.EVENTS_MAIL_FOLDER_NAME,
  subjectContains: process.env.EVENTS_SUBJECT_CONTAINS ?? 'Eventos de',
  lookbackDays: Number(process.env.EVENTS_LOOKBACK_DAYS ?? '365'),
  maxMessages: Number(process.env.EVENTS_MAX_MESSAGES ?? '20'),
  source: process.env.EVENTS_SOURCE ?? 'Outlook HTML',
  fixturePath: process.env.EVENTS_HTML_FIXTURE_PATH,
};

function readEnv(...names) {
  return names.map((name) => process.env[name]).find(Boolean);
}

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(value) {
  const slug = normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

  return slug || 'evento';
}

function escapeODataString(value) {
  return String(value).replace(/'/g, "''");
}

function getSinceIso() {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - config.lookbackDays);
  since.setUTCHours(0, 0, 0, 0);
  return since.toISOString();
}

function formatDateOnly(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
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

function extractFirstHref(html) {
  const match = String(html).match(/<a\b[^>]*href=["']([^"']+)["']/i);
  return match ? decodeHtmlEntities(match[1]) : '';
}

function readDateParts(value) {
  const text = stripTags(value).replace(/\s+/g, ' ').trim();
  const lower = normalizeSearch(text);

  if (!text) {
    return null;
  }

  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return { iso: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, text };
  }

  const numericMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (numericMatch) {
    const year = numericMatch[3].length === 2 ? `20${numericMatch[3]}` : numericMatch[3];
    return {
      iso: `${year}-${numericMatch[2].padStart(2, '0')}-${numericMatch[1].padStart(2, '0')}`,
      text,
    };
  }

  const monthMatch = lower.match(/\b(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})\b/i);
  if (monthMatch) {
    const months = {
      enero: '01',
      febrero: '02',
      marzo: '03',
      abril: '04',
      mayo: '05',
      junio: '06',
      julio: '07',
      agosto: '08',
      septiembre: '09',
      setiembre: '09',
      octubre: '10',
      noviembre: '11',
      diciembre: '12',
    };
    const month = months[normalizeSearch(monthMatch[2])];

    if (month) {
      return {
        iso: `${monthMatch[3]}-${month}-${monthMatch[1].padStart(2, '0')}`,
        text,
      };
    }
  }

  return null;
}

function readTimeText(value) {
  const text = stripTags(value).replace(/\s+/g, ' ').trim();
  return text || '';
}

function inferWorkSchedule(scheduleText, timeText) {
  const text = normalizeSearch(scheduleText);

  if (text.includes('fuera') || text.includes('after hours') || text.includes('outside')) {
    return 'fuera_horario';
  }

  if (text.includes('laboral') || text.includes('workday') || text.includes('work hours')) {
    return 'laboral';
  }

  const timeMatch = String(timeText).match(/\b(\d{1,2})(?::(\d{2}))?\b/);
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    if (hour < 8 || hour >= 18) {
      return 'fuera_horario';
    }
  }

  return 'laboral';
}

function stripHtmlAndNormalize(value) {
  return normalizeSearch(stripTags(value));
}

function extractCellHtml(rowHtml) {
  const cells = [];
  const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match;

  while ((match = cellRegex.exec(rowHtml))) {
    cells.push(match[1]);
  }

  return cells;
}

function findTableRows(tableHtml) {
  const rows = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;

  while ((match = rowRegex.exec(tableHtml))) {
    rows.push(match[1]);
  }

  return rows;
}

function buildHeaderMap(headerCells) {
  const headers = headerCells.map((cell) => stripHtmlAndNormalize(cell));
  const matchIndex = (aliases) => headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));

  return {
    title: matchIndex(['titulo', 'evento', 'name', 'title']),
    organization: matchIndex(['organizacion', 'empresa', 'organization', 'organizer', 'equipo', 'departamento']),
    format: matchIndex(['formato', 'format', 'modalidad', 'tipo']),
    category: matchIndex(['categoria', 'category', 'area', 'tema']),
    date: matchIndex(['fecha', 'date', 'dia', 'día']),
    time: matchIndex(['hora', 'time', 'horario']),
    url: matchIndex(['enlace', 'link', 'url', 'cta']),
    cta: matchIndex(['cta', 'accion', 'action', 'texto', 'boton', 'botón']),
    schedule: matchIndex(['laboral', 'schedule', 'work schedule', 'fuera']),
    tags: matchIndex(['tags', 'etiquetas']),
  };
}

function valueAt(cells, index) {
  if (index < 0 || index >= cells.length) {
    return '';
  }

  return cells[index] ?? '';
}

function parseTimeCellToRange(timeText) {
  const text = readTimeText(timeText);
  if (!text) {
    return { timeText: '', startDate: null, endDate: null };
  }

  return { timeText: text, startDate: null, endDate: null };
}

function parseEventRow(cells, headerMap, fallbackIndex) {
  const cellText = cells.map((cell) => stripTags(cell));
  const cellHtml = cells;

  const title = stripTags(valueAt(cellHtml, headerMap.title >= 0 ? headerMap.title : fallbackIndex[0]));
  const organization = stripTags(valueAt(cellHtml, headerMap.organization >= 0 ? headerMap.organization : fallbackIndex[1]));
  const format = stripTags(valueAt(cellHtml, headerMap.format >= 0 ? headerMap.format : fallbackIndex[2]));
  const category = stripTags(valueAt(cellHtml, headerMap.category >= 0 ? headerMap.category : fallbackIndex[3]));
  const dateCell = valueAt(cellHtml, headerMap.date >= 0 ? headerMap.date : fallbackIndex[4]);
  const timeCell = valueAt(cellHtml, headerMap.time >= 0 ? headerMap.time : fallbackIndex[5]);
  const urlCell = valueAt(cellHtml, headerMap.url >= 0 ? headerMap.url : fallbackIndex[6]);
  const ctaCell = valueAt(cellHtml, headerMap.cta >= 0 ? headerMap.cta : fallbackIndex[7]);
  const scheduleCell = valueAt(cellHtml, headerMap.schedule >= 0 ? headerMap.schedule : fallbackIndex[8]);
  const tagsCell = valueAt(cellHtml, headerMap.tags >= 0 ? headerMap.tags : fallbackIndex[9]);

  const dateParts = readDateParts(dateCell);
  const timeText = readTimeText(timeCell);
  const startDate = dateParts?.iso ?? '';
  const endDate = dateParts?.iso ?? '';
  const url = extractFirstHref(urlCell) || extractFirstHref(ctaCell) || stripTags(urlCell) || stripTags(ctaCell);
  const cta = stripTags(ctaCell) || 'Abrir';
  const schedule = inferWorkSchedule(scheduleCell, timeText);
  const tags = stripTags(tagsCell)
    .split(/[,|/]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!title && !organization && !dateParts) {
    return null;
  }

  const event = {
    title,
    organization,
    format,
    category,
    startDate,
    endDate,
    timezone: 'Europe/Madrid',
    workSchedule: schedule,
    url,
    cta,
    source: config.source,
    tags,
    dateText: dateParts?.text,
    timeText,
  };

  const idSeed = [
    event.title,
    event.organization,
    event.startDate,
    event.endDate,
    event.format,
    event.url,
    event.category,
  ]
    .filter(Boolean)
    .join('|');

  return {
    id: `event-${slugify(idSeed)}`,
    ...event,
  };
}

function parseEventsFromHtml(html) {
  const tables = [];
  const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let match;

  while ((match = tableRegex.exec(html))) {
    tables.push(match[1]);
  }

  const events = [];

  for (const table of tables) {
    const rows = findTableRows(table).filter((row) => stripTags(row).length > 0);
    if (rows.length === 0) {
      continue;
    }

    const headerCells = extractCellHtml(rows[0]);
    const headerMap = buildHeaderMap(headerCells);
    const hasRecognizedHeader = Object.values(headerMap).some((index) => index >= 0);
    const dataRows = hasRecognizedHeader ? rows.slice(1) : rows;

    for (const row of dataRows) {
      const cells = extractCellHtml(row);
      if (cells.length === 0) {
        continue;
      }

      const event = parseEventRow(cells, headerMap, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      if (event) {
        events.push(event);
      }
    }
  }

  return events;
}

function uniqueById(items) {
  const seen = new Set();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

async function getAccessToken() {
  const existingToken = readEnv('GRAPH_ACCESS_TOKEN', 'MS_GRAPH_ACCESS_TOKEN');

  if (existingToken) {
    return existingToken;
  }

  const tenantId = readEnv('EVENTS_TENANT_ID', 'NEWS_TENANT_ID', 'SHAREPOINT_TENANT_ID', 'AZURE_TENANT_ID', 'TENANT_ID');
  const clientId = readEnv('EVENTS_CLIENT_ID', 'NEWS_CLIENT_ID', 'SHAREPOINT_CLIENT_ID', 'AZURE_CLIENT_ID', 'CLIENT_ID');
  const clientSecret = readEnv(
    'EVENTS_CLIENT_SECRET',
    'NEWS_CLIENT_SECRET',
    'SHAREPOINT_CLIENT_SECRET',
    'AZURE_CLIENT_SECRET',
    'CLIENT_SECRET',
  );

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Graph credentials. Set EVENTS_TENANT_ID, EVENTS_CLIENT_ID and EVENTS_CLIENT_SECRET, or reuse NEWS_* / SHAREPOINT_* secrets.',
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

async function graphCollection(accessToken, url, limit = 200) {
  const items = [];
  let nextUrl = url;

  while (nextUrl && items.length < limit) {
    const payload = await graphRequest(accessToken, nextUrl);
    items.push(...(payload.value ?? []));
    nextUrl = payload['@odata.nextLink'];
  }

  return items;
}

function formatFolderList(folders) {
  return folders
    .map((folder) => `- ${folder.displayName ?? '(sin nombre)'} (${folder.id ?? 'sin id'})`)
    .join('\n');
}

async function resolveMailFolder(accessToken) {
  if (config.folderId) {
    console.log(`[Outlook events] Carpeta seleccionada: EVENTS_MAIL_FOLDER_ID=${config.folderId}`);
    console.log(`[Outlook events] folderId encontrado: ${config.folderId}`);
    return config.folderId;
  }

  if (config.folderName) {
    console.log(`[Outlook events] Carpeta seleccionada: EVENTS_MAIL_FOLDER=${config.folderName}`);
    const folders = await graphCollection(
      accessToken,
      `/users/${encodeURIComponent(config.mailboxUserId)}/mailFolders?$top=100`,
      100,
    );
    const folder = folders.find((item) => item.displayName === config.folderName);

    if (!folder?.id) {
      const availableFolders = formatFolderList(folders);
      throw new Error(
        `EVENTS_MAIL_FOLDER "${config.folderName}" not found for mailbox ${config.mailboxUserId}.\nAvailable folders:\n${availableFolders || '- (sin carpetas encontradas)'}`,
      );
    }

    console.log(`[Outlook events] folderId encontrado: ${folder.id}`);
    return folder.id;
  }

  console.log('[Outlook events] Carpeta seleccionada: inbox');
  console.log('[Outlook events] folderId encontrado: inbox');
  return 'inbox';
}

async function listEventMessages(accessToken) {
  if (!config.mailboxUserId) {
    throw new Error('Missing EVENTS_MAILBOX_USER_ID. Use the mailbox userPrincipalName or id that receives the events email.');
  }

  const folderId = await resolveMailFolder(accessToken);
  const select = ['id', 'subject', 'receivedDateTime', 'hasAttachments', 'from', 'webLink'].join(',');
  const filter = encodeURIComponent(
    `contains(subject,'${escapeODataString(config.subjectContains)}') and hasAttachments eq true and receivedDateTime ge ${getSinceIso()}`,
  );
  const orderBy = encodeURIComponent('receivedDateTime desc');
  const url = `/users/${encodeURIComponent(config.mailboxUserId)}/mailFolders/${encodeURIComponent(folderId)}/messages?$select=${select}&$filter=${filter}&$orderby=${orderBy}&$top=${config.maxMessages}`;

  const messages = await graphCollection(accessToken, url, config.maxMessages);
  console.log(`[Outlook events] Numero de mensajes recuperados: ${messages.length}`);
  return messages;
}

async function listMessageAttachments(accessToken, messageId) {
  const select = ['id', 'name', 'contentType', 'size', 'contentBytes', 'isInline'].join(',');
  return graphCollection(
    accessToken,
    `/users/${encodeURIComponent(config.mailboxUserId)}/messages/${encodeURIComponent(messageId)}/attachments?$select=${select}`,
    50,
  );
}

function isHtmlAttachment(attachment) {
  const name = normalizeSearch(attachment.name);
  const type = normalizeSearch(attachment.contentType);
  return name.endsWith('.html') || name.endsWith('.htm') || type.includes('html');
}

function decodeAttachmentHtml(attachment) {
  if (!attachment.contentBytes) {
    return '';
  }

  return Buffer.from(attachment.contentBytes, 'base64').toString('utf8');
}

async function collectEventsFromMailbox(accessToken) {
  const messages = await listEventMessages(accessToken);
  const parsedEvents = [];

  for (const message of messages) {
    const attachments = await listMessageAttachments(accessToken, message.id);
    const htmlAttachments = attachments.filter(isHtmlAttachment);

    for (const attachment of htmlAttachments) {
      const html = decodeAttachmentHtml(attachment);
      if (!html) {
        continue;
      }

      console.log(`[Outlook events] Procesando adjunto HTML: ${attachment.name}`);
      parsedEvents.push(...parseEventsFromHtml(html));
    }
  }

  return parsedEvents;
}

async function loadEventSources() {
  if (config.fixturePath) {
    const html = await readFile(path.resolve(config.fixturePath), 'utf8');
    console.log(`[Outlook events] Usando fixture local: ${config.fixturePath}`);
    return parseEventsFromHtml(html);
  }

  const accessToken = await getAccessToken();
  return collectEventsFromMailbox(accessToken);
}

function normalizeEvents(events) {
  return uniqueById(events)
    .filter((event) => event.startDate && event.endDate && event.title)
    .sort((left, right) => {
      return (
        left.startDate.localeCompare(right.startDate) ||
        left.endDate.localeCompare(right.endDate) ||
        left.organization.localeCompare(right.organization, 'es', { sensitivity: 'base' }) ||
        left.title.localeCompare(right.title, 'es', { sensitivity: 'base' })
      );
    });
}

async function main() {
  const parsedEvents = await loadEventSources();
  if (parsedEvents.length === 0) {
    throw new Error('No event rows were parsed from the Outlook HTML attachment(s).');
  }

  const mergedEvents = normalizeEvents(parsedEvents);

  await writeFile(outputPath, `${JSON.stringify(mergedEvents, null, 2)}\n`, 'utf8');

  console.log(`Outlook events synced: ${mergedEvents.length} total events.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
