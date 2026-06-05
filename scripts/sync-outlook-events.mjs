import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  downloadAttachmentContent,
  downloadAttachmentValue,
  getMessageAttachments,
  getAccessToken,
  loadTextFile,
  listRecentMessagesFromFolder,
  normalizeMailSubject,
  normalizeText,
  resolveMailFolderId,
  sanitizeFolderReference,
} from './outlook-graph-utils.mjs';

const outputPath = path.resolve('src/data/events.json');

const rawFolderReference =
  process.env.EVENTS_MAIL_FOLDER_RAW ?? process.env.EVENTS_MAIL_FOLDER ?? process.env.EVENTS_MAIL_FOLDER_NAME ?? '';
const effectiveFolderReference = sanitizeFolderReference(process.env.EVENTS_MAIL_FOLDER ?? rawFolderReference);

const config = {
  mailboxUserId: process.env.EVENTS_MAILBOX_USER_ID,
  folderName: effectiveFolderReference,
  rawFolderReference,
  folderId: process.env.EVENTS_MAIL_FOLDER_ID,
  subjectPrefix: process.env.EVENTS_SUBJECT_PREFIX || process.env.EVENTS_SUBJECT_CONTAINS || 'Eventos de',
  lookbackDays: Number(process.env.EVENTS_LOOKBACK_DAYS ?? '45'),
  maxMessages: Number(process.env.EVENTS_MAX_MESSAGES ?? '20'),
  source: process.env.EVENTS_SOURCE ?? 'Outlook HTML',
  fixturePath: process.env.EVENTS_HTML_FIXTURE_PATH,
};

function slugify(value) {
  const slug = normalizeText(value)
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

function extractClassText(html, className) {
  const pattern = new RegExp(
    `<(?:div|span|a|p|td)\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/(?:div|span|a|p|td)>`,
    'i',
  );
  const match = String(html).match(pattern);
  return match ? match[1] : '';
}

function extractYearFromHtml(html) {
  const titleMatch = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const candidates = [titleMatch ? stripTags(titleMatch[1]) : '', String(html)];

  for (const candidate of candidates) {
    const yearMatch = String(candidate).match(/\b(20\d{2})\b/);
    if (yearMatch) {
      return Number(yearMatch[1]);
    }
  }

  return new Date().getFullYear();
}

function monthNameToNumber(monthName) {
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

  return months[normalizeText(monthName)] ?? '';
}

function buildDateIso(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function readDateParts(value, defaultYear = new Date().getFullYear()) {
  const text = stripTags(value).replace(/\s+/g, ' ').trim();
  const lower = normalizeText(text);

  if (!text) {
    return null;
  }

  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return { iso: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, endIso: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, text };
  }

  const numericMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (numericMatch) {
    const year = numericMatch[3].length === 2 ? `20${numericMatch[3]}` : numericMatch[3];
    const iso = `${year}-${numericMatch[2].padStart(2, '0')}-${numericMatch[1].padStart(2, '0')}`;
    return { iso, endIso: iso, text };
  }

  const rangeMatch = lower.match(/\b(\d{1,2})\s*[–-]\s*(\d{1,2})\s+de\s+([a-záéíóúñ]+)(?:\s+de\s+(\d{4}))?\b/i);
  if (rangeMatch) {
    const month = monthNameToNumber(rangeMatch[3]);
    const year = Number(rangeMatch[4] ?? defaultYear);

    if (month) {
      return {
        iso: buildDateIso(year, month, rangeMatch[1]),
        endIso: buildDateIso(year, month, rangeMatch[2]),
        text,
      };
    }
  }

  const monthMatch = lower.match(/\b(\d{1,2})\s+de\s+([a-záéíóúñ]+)(?:\s+de\s+(\d{4}))?\b/i);
  if (monthMatch) {
    const month = monthNameToNumber(monthMatch[2]);
    const year = Number(monthMatch[3] ?? defaultYear);

    if (month) {
      const iso = buildDateIso(year, month, monthMatch[1]);
      return { iso, endIso: iso, text };
    }
  }

  return null;
}

function readTimeText(value) {
  return stripTags(value).replace(/\s+/g, ' ').trim();
}

function extractTimeFromDateCell(dateCell) {
  const text = stripTags(dateCell).replace(/\s+/g, ' ').trim();
  const timeMatch = text.match(/\b(\d{1,2}:\d{2}(?:\s*(?:CET|CEST|UTC|GMT))?)\b/i);
  return timeMatch ? timeMatch[1].replace(/\s+/g, ' ').trim() : '';
}

function detectFormat(value) {
  const text = normalizeText(value);

  if (text.includes('online')) {
    return 'online';
  }

  if (text.includes('presencial') || text.includes('in person') || text.includes('onsite')) {
    return 'presencial';
  }

  return '';
}

function detectScheduleFromChunk(chunk) {
  const text = normalizeText(chunk);

  if (text.includes('fuera de horario laboral')) {
    return 'fuera_horario';
  }

  if (text.includes('horario laboral')) {
    return 'laboral';
  }

  return '';
}

function inferWorkSchedule(scheduleText, timeText) {
  const text = normalizeText(scheduleText);

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
  const headers = headerCells.map((cell) => normalizeText(stripTags(cell)));
  const matchIndex = (aliases) => headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));

  return {
    title: matchIndex(['titulo', 'evento', 'name', 'title']),
    organization: matchIndex(['organizacion', 'empresa', 'organization', 'organizer', 'equipo', 'departamento']),
    format: matchIndex(['formato', 'format', 'modalidad', 'tipo']),
    category: matchIndex(['categoria', 'category', 'area', 'tema']),
    date: matchIndex(['fecha', 'date', 'dia']),
    time: matchIndex(['hora', 'time', 'horario']),
    url: matchIndex(['enlace', 'link', 'url', 'cta']),
    cta: matchIndex(['cta', 'accion', 'action', 'texto', 'boton']),
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

function parseEventRow(cells, headerMap, fallbackIndex, options = {}) {
  const firstCell = valueAt(cells, headerMap.title >= 0 ? headerMap.title : 0);
  const secondCell = valueAt(cells, headerMap.organization >= 0 ? headerMap.organization : 1);
  const thirdCell = valueAt(cells, headerMap.date >= 0 ? headerMap.date : 2);
  const fourthCell = valueAt(cells, headerMap.url >= 0 ? headerMap.url : 3);

  const title =
    stripTags(extractClassText(firstCell, 'event-name')) ||
    stripTags(firstCell).replace(/\b(?:online|presencial)\b/gi, '').replace(/\s+/g, ' ').trim();
  const organization = stripTags(extractClassText(secondCell, 'org-badge')) || stripTags(secondCell);
  const format =
    detectFormat(firstCell) ||
    detectFormat(secondCell) ||
    detectFormat(title) ||
    stripTags(extractClassText(firstCell, 'fbadge')) ||
    '';
  const category = options.sectionCategory || detectScheduleFromChunk(options.sectionLabel ?? '') || '';
  const dateCell = thirdCell;
  const timeCell = '';
  const scheduleCell = options.sectionLabel ?? '';
  const urlCell = fourthCell;
  const ctaCell = fourthCell;
  const tagsCell = '';

  const dateParts = readDateParts(dateCell, options.defaultYear);
  const timeText = readTimeText(timeCell) || extractTimeFromDateCell(dateCell);
  const startDate = dateParts?.iso ?? '';
  const endDate = dateParts?.endIso ?? dateParts?.iso ?? '';
  const url = extractFirstHref(urlCell) || extractFirstHref(ctaCell) || stripTags(urlCell) || stripTags(ctaCell);
  const cta = stripTags(ctaCell) || 'Abrir';
  const schedule = options.scheduleHint || inferWorkSchedule(scheduleCell, timeText);
  const tags = [];

  if (!title || !dateParts) {
    return null;
  }

  const event = {
    title,
      organization,
      format,
      category: category || (schedule === 'fuera_horario' ? 'Fuera de horario laboral' : 'Horario laboral'),
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

  const idSeed = [event.title, event.organization, event.startDate, event.endDate, event.format, event.url, event.category]
    .filter(Boolean)
    .join('|');

  return {
    id: `event-${slugify(idSeed)}`,
    ...event,
  };
}

function parseEventsFromHtml(html) {
  const preview = String(html).slice(0, 240).replace(/\s+/g, ' ');
  console.log(`[Outlook events] preview HTML adjunto: ${preview}`);
  const defaultYear = extractYearFromHtml(html);
  const tables = [];
  const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let match;

  while ((match = tableRegex.exec(html))) {
    tables.push(match[1]);
  }

  const events = [];
  const candidateBlocks = [];
  let previousTableEnd = 0;

  for (const table of tables) {
    const tableIndex = html.indexOf(table, previousTableEnd);
    const betweenTables = tableIndex >= 0 ? html.slice(previousTableEnd, tableIndex) : '';
    const scheduleHint = detectScheduleFromChunk(betweenTables);
    const sectionLabelMatch = betweenTables.match(/<div\b[^>]*class=["'][^"']*section-label[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const sectionLabel = sectionLabelMatch ? stripTags(sectionLabelMatch[1]) : '';
    previousTableEnd = tableIndex >= 0 ? tableIndex + table.length : previousTableEnd;

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

      const event = parseEventRow(cells, headerMap, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
        defaultYear,
        scheduleHint,
        sectionLabel,
        sectionCategory: sectionLabel,
      });
      if (event) {
        events.push(event);
      } else {
        candidateBlocks.push(stripTags(row));
      }
    }
  }

  if (events.length === 0 && candidateBlocks.length > 0) {
    const fallbackEvents = parseLooseEventsFromTextBlocks(candidateBlocks);
    if (fallbackEvents.length > 0) {
      return fallbackEvents;
    }
  }

  return events;
}

function parseLooseEventsFromTextBlocks(blocks) {
  const events = [];
  for (const block of blocks) {
    const normalized = block.replace(/\s+/g, ' ').trim();
    const titleMatch = normalized.match(/^(.*?)\s+(?:\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
    const dateParts = readDateParts(normalized);

    if (!titleMatch || !dateParts) {
      continue;
    }

    const title = titleMatch[1].trim();
    if (!title) {
      continue;
    }

    events.push({
      id: `event-${slugify(title + dateParts.iso)}`,
      title,
      organization: '',
      format: '',
      category: '',
      startDate: dateParts.iso,
      endDate: dateParts.iso,
      timezone: 'Europe/Madrid',
      workSchedule: 'laboral',
      url: '',
      cta: 'Abrir',
      source: config.source,
      tags: [],
      dateText: dateParts.text,
      timeText: '',
    });
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

function messageMatches(message) {
  const subject = normalizeMailSubject(message.subject ?? '');
  const prefix = normalizeMailSubject(config.subjectPrefix);

  return subject.startsWith(prefix) || subject.includes(prefix);
}

function isHtmlAttachment(attachment) {
  const name = normalizeText(attachment.name);
  const type = normalizeText(attachment.contentType);
  return name.endsWith('.html') || name.endsWith('.htm') || type.includes('html');
}

async function loadEventSources() {
  console.log(`[Outlook events] mailbox usado: ${config.mailboxUserId ?? '(vacío)'}`);
  console.log(`[Outlook events] EVENTS_MAIL_FOLDER bruto: ${config.rawFolderReference || '(vacío)'}`);
  if (config.folderName) {
    console.log(`[Outlook events] carpeta efectiva: ${config.folderName}`);
  } else {
    console.log('[Outlook events] EVENTS_MAIL_FOLDER no está definida; usando fallback inbox.');
  }
  console.log(`[Outlook events] prefijo de asunto: ${config.subjectPrefix}`);

  if (config.fixturePath) {
    const html = await loadTextFile(path.resolve(config.fixturePath));
    console.log(`[Outlook events] Usando fixture local: ${config.fixturePath}`);
    return parseEventsFromHtml(html);
  }

  const accessToken = await getAccessToken('EVENTS', 'EVENTS');
  const resolvedFolder = await resolveMailFolderId(accessToken, {
    mailboxUserId: config.mailboxUserId,
    folderReference: config.folderName,
    folderId: config.folderId,
    logPrefix: 'Outlook events',
    folderLabel: 'events',
  });
  const messages = await listRecentMessagesFromFolder(
    accessToken,
    config.mailboxUserId,
    resolvedFolder.folderId,
    Math.max(20, config.maxMessages),
    ['id', 'subject', 'receivedDateTime', 'from', 'webLink'],
  );
  console.log(`[Outlook events] ruta final resuelta: ${resolvedFolder.resolvedPath}`);
  const candidateMessages = messages
    .filter(messageMatches)
    .sort((left, right) => new Date(right.receivedDateTime ?? 0).getTime() - new Date(left.receivedDateTime ?? 0).getTime());

  console.log(
    `[Outlook events] asuntos candidatos detectados: ${
      candidateMessages.length > 0 ? candidateMessages.map((message) => message.subject).join(' | ') : '(ninguno)'
    }`,
  );

  if (candidateMessages.length === 0) {
    throw new Error(
      `No Outlook message found in folder "${config.folderName ?? 'inbox'}" matching prefix "${config.subjectPrefix}".`,
    );
  }

  const selectedMessage = candidateMessages[0];
  console.log(`[Outlook events] asunto seleccionado: ${selectedMessage.subject}`);

  const attachments = await getMessageAttachments(accessToken, config.mailboxUserId, selectedMessage.id);
  const htmlAttachment = attachments.find(isHtmlAttachment);

  if (!htmlAttachment) {
    throw new Error(`Selected Outlook message "${selectedMessage.subject}" has no HTML attachment.`);
  }

  console.log(`[Outlook events] adjunto HTML seleccionado: ${htmlAttachment.name}`);

  const html = htmlAttachment.contentBytes
    ? downloadAttachmentContent(htmlAttachment)
    : downloadAttachmentContent(
        await downloadAttachmentValue(accessToken, config.mailboxUserId, selectedMessage.id, htmlAttachment.id),
      );

  if (!html) {
    throw new Error(`HTML attachment "${htmlAttachment.name}" has no readable content.`);
  }

  return parseEventsFromHtml(html);
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
  if (!config.fixturePath && !config.mailboxUserId) {
    throw new Error('Missing EVENTS_MAILBOX_USER_ID. Use the mailbox userPrincipalName or id that receives the events email.');
  }

  const parsedEvents = await loadEventSources();
  if (parsedEvents.length === 0) {
    throw new Error('No event rows were parsed from the Outlook HTML attachment(s).');
  }

  const mergedEvents = normalizeEvents(parsedEvents);
  await writeFile(outputPath, `${JSON.stringify(mergedEvents, null, 2)}\n`, 'utf8');

  console.log(`[Outlook events] numero de eventos extraidos: ${mergedEvents.length}`);
  console.log(`Outlook events synced: ${mergedEvents.length} total events.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
