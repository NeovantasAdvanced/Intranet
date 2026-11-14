const crypto = require('node:crypto');
const { createContainerClient } = require('./knowledge-blob.cjs');
const {
  MAX_PDF_BYTES,
  TARGET_DOCUMENT,
  streamToBuffer,
  extractPdfText,
} = require('./knowledge-pdf.cjs');

const INDEX_PREFIX = 'knowledge-index/documents/';
const SCHEMA_VERSION = '1.0';
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ ]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stableId(document, position, text) {
  return crypto.createHash('sha256').update(`${document}\0${position}\0${text}`).digest('hex').slice(0, 24);
}

function splitText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  if (overlap >= chunkSize) throw new Error('INVALID_CHUNK_OVERLAP');
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(' ', end);
      if (boundary > start + Math.floor(chunkSize * 0.7)) end = boundary;
    }
    const value = normalized.slice(start, end).trim();
    if (value) chunks.push({ position: start, text: value });
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

function buildDocumentIndex({ document = TARGET_DOCUMENT, pageCount, text, etag = null, indexedAt = new Date().toISOString() }) {
  const normalized = normalizeText(text);
  if (!normalized) {
    const error = new Error('PDF_NO_TEXT');
    error.code = 'PDF_NO_TEXT';
    throw error;
  }
  const chunks = splitText(normalized).map(({ position, text: chunkText }) => ({
    id: stableId(document, position, chunkText),
    document,
    text: chunkText,
    position,
    page: null,
  }));
  return {
    schemaVersion: SCHEMA_VERSION,
    document,
    etag,
    indexedAt,
    pageCount,
    extractedCharacters: normalized.length,
    chunkCount: chunks.length,
    chunks,
  };
}

function getIndexBlobName({ document = TARGET_DOCUMENT, etag = null }) {
  const version = crypto.createHash('sha256').update(`${document}\0${etag ?? 'no-etag'}`).digest('hex').slice(0, 16);
  return `${INDEX_PREFIX}codigo-etico-conducta-${version}.json`;
}

async function downloadTargetPdf(containerClient = createContainerClient()) {
  const response = await containerClient.getBlobClient(TARGET_DOCUMENT).download();
  if (response.contentLength > MAX_PDF_BYTES) {
    const error = new Error('PDF_TOO_LARGE');
    error.code = 'PDF_TOO_LARGE';
    throw error;
  }
  return {
    buffer: await streamToBuffer(response.readableStreamBody),
    etag: response.etag ?? null,
  };
}

async function createDocumentIndex({ containerClient, parser, indexedAt } = {}) {
  const downloaded = await downloadTargetPdf(containerClient);
  const extracted = await extractPdfText(downloaded.buffer, parser);
  const index = buildDocumentIndex({
    document: TARGET_DOCUMENT,
    pageCount: extracted.pageCount,
    text: extracted.text,
    etag: downloaded.etag,
    indexedAt,
  });
  return { index, blobName: getIndexBlobName(index) };
}

async function writeDocumentIndex(containerClient, blobName, index) {
  if (!String(blobName).startsWith(INDEX_PREFIX)) throw new Error('INDEX_PATH_NOT_ALLOWED');
  await containerClient.getBlockBlobClient(blobName).uploadData(Buffer.from(JSON.stringify(index)), {
    overwrite: false,
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
  });
}

module.exports = {
  INDEX_PREFIX,
  SCHEMA_VERSION,
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  MAX_PDF_BYTES,
  normalizeText,
  splitText,
  stableId,
  buildDocumentIndex,
  getIndexBlobName,
  downloadTargetPdf,
  createDocumentIndex,
  writeDocumentIndex,
};
