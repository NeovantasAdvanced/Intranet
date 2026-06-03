const SPANISH_MONTHS = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, entity) => named[entity.toLowerCase()] ?? match);
}

function normalizeSpaces(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function normalizeText(value) {
  return normalizeSpaces(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stripLeadingNewsNumber(value) {
  return normalizeSpaces(value).replace(/^\d+\.\s*/, '');
}

function slugify(value) {
  const slug = normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);

  return slug || 'noticia';
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

function htmlToText(rawContent) {
  const rawText = extractHtmlFromMht(rawContent);
  if (!/[<][a-z!/]/i.test(rawText)) {
    return decodeHtmlEntities(rawText).replace(/\r/g, '');
  }

  const protectedUrls = [];
  let text = rawText
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, innerText) => `${innerText} <${href}>`)
    .replace(/<\s*(https?:\/\/[^>\s]+)\s*>/gi, (_, url) => {
      const token = `__URL_PLACEHOLDER_${protectedUrls.length}__`;
      protectedUrls.push({ token, url });
      return token;
    });

  text = decodeHtmlEntities(
    text
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|section|article|table)>/gi, '\n')
      .replace(/<td\b[^>]*>/gi, '\t')
      .replace(/<\/td>/gi, '\t')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );

  for (const { token, url } of protectedUrls) {
    text = text.replace(token, `<${url}>`);
  }

  return text;
}

function normalizeNewsEmailText(rawContent) {
  const text = htmlToText(rawContent).replace(/\r/g, '');
  return text
    .split('\n')
    .map((line) => normalizeSpaces(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseSpanishDateText(dateText) {
  const match = normalizeSpaces(dateText).match(/(\d{1,2})(?:\s+de)?\s+([a-záéíóúñ]+)\s+(\d{4})/i);
  if (!match) {
    return '';
  }

  const day = Number(match[1]);
  const monthName = normalizeText(match[2]);
  const year = Number(match[3]);
  const month = SPANISH_MONTHS[monthName];

  if (!month || !day || !year) {
    return '';
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function extractDateTextFromHeading(heading) {
  const normalized = normalizeSpaces(heading);
  const match = normalized.match(/briefing\s*[·•\-]\s*(.+)$/i);
  return match ? normalizeSpaces(match[1]) : '';
}

function extractDateTextFromSubject(subject) {
  const normalized = normalizeSpaces(subject);
  const match = normalized.match(/(\d{1,2}(?:\s+de)?\s+[a-záéíóúñ]+\s+\d{4})/i);
  return match ? normalizeSpaces(match[1]) : '';
}

function isCategoryLine(line) {
  const cleaned = normalizeSpaces(line).replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/u, '');
  const match = cleaned.match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+?)\s*\((\d+)\)$/u);
  if (!match) {
    return null;
  }

  return {
    category: normalizeSpaces(match[1]),
    expectedCount: Number(match[2]),
  };
}

function isItemLine(line) {
  const match = normalizeSpaces(line).match(/^(\d+)\.\s+(.+)$/);
  if (!match) {
    return null;
  }

  return {
    number: Number(match[1]),
    title: normalizeSpaces(match[2]),
  };
}

function extractUrlFromText(lines) {
  const text = lines.join('\n');
  const angleMatch = text.match(/<\s*(https?:\/\/[^>\s]+)\s*>/i);
  if (angleMatch) {
    return angleMatch[1];
  }

  const directMatch = text.match(/https?:\/\/[^\s<>"']+/i);
  return directMatch ? directMatch[0] : '';
}

function buildRawMeta({
  briefingTitle,
  dateText,
  totalNews,
  subject,
  newsletterSource,
  category,
  expectedCount,
  itemNumber,
  marketLine,
  sourceLine,
}) {
  return {
    briefingTitle,
    dateText,
    totalNews,
    subject,
    newsletterSource,
    sectionCategory: category,
    sectionExpectedCount: expectedCount,
    itemNumber,
    marketLine,
    sourceLine,
  };
}

function parseItemBlock(block, context) {
  const contentLines = block.lines.map((line) => normalizeSpaces(line));
  const nonEmptyLines = contentLines.filter(Boolean);
  const sourceLineIndex = contentLines.findIndex((line) => /Fuente:/i.test(line));
  const sourceLine = sourceLineIndex >= 0 ? contentLines[sourceLineIndex] : '';
  const marketLine = sourceLine
    ? normalizeSpaces(
        sourceLine
          .replace(/\s*[·•]\s*Fuente:.*$/i, '')
          .replace(/\s*Fuente:.*$/i, ''),
      )
    : nonEmptyLines[0] ?? '';
  const source = sourceLine.match(/Fuente:\s*(.+)$/i)?.[1]?.trim() ?? '';
  const readMoreIndex = contentLines.findIndex((line) => /^leer m[aá]s\b/i.test(line) || /https?:\/\//i.test(line));
  const summaryStart = sourceLineIndex >= 0 ? sourceLineIndex + 1 : marketLine ? 1 : 0;
  const summaryEnd = readMoreIndex >= 0 ? readMoreIndex : contentLines.length;
  const summaryLines = contentLines
    .slice(summaryStart, summaryEnd)
    .filter((line) => line && !/^leer m[aá]s\b/i.test(line) && !/^https?:\/\//i.test(line));
  const summary = normalizeSpaces(summaryLines.join(' ')) || '(resumen no disponible)';
  const url = extractUrlFromText(contentLines);
  const dateIso = context.dateIso || '';
  const id = `news-${dateIso}-${slugify([context.category, block.title, dateIso].filter(Boolean).join(' '))}`;

  if (!block.title || !url) {
    return null;
  }

  return {
    id,
    title: block.title,
    category: context.category,
    source: source || 'Desconocido',
    summary,
    excerpt: summary,
    url,
    href: url,
    date: dateIso,
    rawMeta: buildRawMeta({
      briefingTitle: context.briefingTitle,
      dateText: context.dateText,
      totalNews: context.totalNews,
      subject: context.subject,
      newsletterSource: context.newsletterSource,
      category: context.category,
      expectedCount: context.expectedCount,
      itemNumber: block.number,
      marketLine,
      sourceLine,
    }),
  };
}

function parseNewsItemsFromNormalizedText(normalizedText, options = {}) {
  const lines = normalizedText.split('\n');
  const metadata = {
    briefingTitle: '',
    dateText: '',
    totalNews: 0,
  };
  const categories = [];
  const items = [];
  let currentCategory = 'Noticias';
  let currentExpectedCount = 0;
  let currentBlock = null;
  const fallbackDateIso = options.fallbackDateIso ? String(options.fallbackDateIso).slice(0, 10) : '';
  const explicitDateIso = options.dateIso ? String(options.dateIso).slice(0, 10) : '';

  const flushBlock = () => {
    if (!currentBlock) {
      return;
    }

    const parsed = parseItemBlock(currentBlock, {
      briefingTitle: metadata.briefingTitle,
      dateText: metadata.dateText,
      dateIso:
        explicitDateIso ||
        parseSpanishDateText(metadata.dateText) ||
        fallbackDateIso ||
        new Date().toISOString().slice(0, 10),
      totalNews: metadata.totalNews,
      subject: options.subject ?? '',
      newsletterSource: options.newsletterSource ?? 'Noticias relevantes de hoy',
      category: currentBlock.category,
      expectedCount: currentBlock.expectedCount,
    });

    if (parsed) {
      items.push(parsed);
    }

    currentBlock = null;
  };

  for (const rawLine of lines) {
    const line = normalizeSpaces(rawLine);
    if (!line) {
      if (currentBlock) {
        currentBlock.lines.push('');
      }
      continue;
    }

    if (/^briefing\b/i.test(line)) {
      metadata.briefingTitle = line;
      metadata.dateText = extractDateTextFromHeading(line) || metadata.dateText;
      if (!metadata.dateText) {
        metadata.dateText = extractDateTextFromSubject(options.subject ?? '') || metadata.dateText;
      }
      continue;
    }

    const totalMatch = line.match(/^(\d+)\s+noticias seleccionadas\s*[·•\-]\s*generado autom[aá]ticamente\b/i);
    if (totalMatch) {
      metadata.totalNews = Number(totalMatch[1]);
      continue;
    }

    const categoryMatch = isCategoryLine(line);
    if (categoryMatch) {
      flushBlock();
      categories.push(categoryMatch);
      currentCategory = categoryMatch.category;
      currentExpectedCount = categoryMatch.expectedCount;
      continue;
    }

    const itemMatch = isItemLine(line);
    if (itemMatch) {
      flushBlock();
      currentBlock = {
        number: itemMatch.number,
        title: stripLeadingNewsNumber(line),
        category: currentCategory,
        expectedCount: currentExpectedCount,
        lines: [],
      };
      continue;
    }

    if (currentBlock) {
      currentBlock.lines.push(line);
    }
  }

  flushBlock();

  const dateText = metadata.dateText || extractDateTextFromSubject(options.subject ?? '') || '';
  const dateIso =
    explicitDateIso ||
    parseSpanishDateText(dateText) ||
    fallbackDateIso ||
    new Date().toISOString().slice(0, 10);

  return {
    items,
    briefingTitle: metadata.briefingTitle,
    dateText,
    dateIso,
    totalNews: metadata.totalNews,
    categoriesDetected: categories,
    normalizedText,
    linksDetected: items.map((item) => item.url).filter(Boolean),
    numberedLines: lines.filter((line) => /^\d+\.\s+/.test(line)),
  };
}

export function parseNewsEmailContent(rawContent, options = {}) {
  const normalizedText = normalizeNewsEmailText(rawContent);
  return parseNewsItemsFromNormalizedText(normalizedText, {
    ...options,
    fallbackDateIso: options.fallbackDateIso || options.emailDate || '',
  });
}

export function extractNewsItemsFromEmailContent(rawContent, options = {}) {
  return parseNewsEmailContent(rawContent, options).items;
}

export function extractNewsItemsFromHtml(rawContent, emailDate = new Date().toISOString()) {
  return extractNewsItemsFromEmailContent(rawContent, { fallbackDateIso: emailDate });
}

export function buildNewsParseDebugSnapshot(parsedEmail) {
  return {
    briefingTitle: parsedEmail.briefingTitle,
    dateText: parsedEmail.dateText,
    dateIso: parsedEmail.dateIso,
    totalNews: parsedEmail.totalNews,
    categoriesDetected: parsedEmail.categoriesDetected,
    numberedLines: parsedEmail.numberedLines,
    linksDetected: parsedEmail.linksDetected,
    normalizedTextPreview: parsedEmail.normalizedText.slice(0, 3000),
    itemsParsed: parsedEmail.items.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      source: item.source,
      url: item.url,
    })),
  };
}

export function normalizeNewsEmailTextContent(rawContent) {
  return normalizeNewsEmailText(rawContent);
}
