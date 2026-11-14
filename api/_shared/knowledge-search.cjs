const { SCHEMA_VERSION } = require('./knowledge-index.cjs');
const { CURRENT_MANIFEST, validateIndex } = require('./knowledge-publish.cjs');

const MAX_QUERY_LENGTH = 200;
const MAX_INDEX_BYTES = 2 * 1024 * 1024;
const MAX_RESULTS = 5;
const MAX_RESULT_TEXT = 2000;
const STOP_WORDS = new Set('a al algo algunas algunos ante antes como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era es esa esas ese eso esos esta estas este esto estos fue ha hacia hasta hay la las le les lo los más me mi mis mucho muy no nos o para pero por que se sin sobre su sus también te ti todo un una uno unas unos y ya'.split(' '));

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeSearchText(value).split(' ').filter((term) => term && !STOP_WORDS.has(term));
}

async function readJsonLimited(containerClient, blobName, maxBytes = MAX_INDEX_BYTES) {
  const response = await containerClient.getBlobClient(blobName).download();
  if (response.contentLength > maxBytes) {
    const error = new Error('INDEX_TOO_LARGE');
    error.code = 'INDEX_TOO_LARGE';
    throw error;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of response.readableStreamBody) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      const error = new Error('INDEX_TOO_LARGE');
      error.code = 'INDEX_TOO_LARGE';
      throw error;
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
}

function validateManifest(manifest) {
  return Boolean(manifest && manifest.schemaVersion === SCHEMA_VERSION && manifest.documents && typeof manifest.documents === 'object' && !Array.isArray(manifest.documents));
}

async function loadPublishedIndexes(containerClient) {
  const manifest = await readJsonLimited(containerClient, CURRENT_MANIFEST);
  if (!validateManifest(manifest)) {
    const error = new Error('MANIFEST_INVALID');
    error.code = 'MANIFEST_INVALID';
    throw error;
  }
  const indexes = [];
  for (const [document, entry] of Object.entries(manifest.documents)) {
    if (!entry || typeof entry.index !== 'string' || !entry.index.startsWith('knowledge-index/documents/') || entry.index.includes('..') || typeof entry.etag !== 'string') {
      const error = new Error('MANIFEST_INVALID');
      error.code = 'MANIFEST_INVALID';
      throw error;
    }
    const index = await readJsonLimited(containerClient, entry.index);
    if (!validateIndex(index, document, entry.etag)) {
      const error = new Error('SEARCH_INDEX_INVALID');
      error.code = 'SEARCH_INDEX_INVALID';
      throw error;
    }
    indexes.push(index);
  }
  return { manifest, indexes };
}

function proximityScore(tokens, terms) {
  const positions = tokens.map((term, index) => terms.has(term) ? index : -1).filter((index) => index >= 0);
  if (positions.length < 2) return 0;
  const span = Math.max(...positions) - Math.min(...positions) + 1;
  return span <= 8 ? 5 : span <= 20 ? 2 : 0;
}

function searchIndexes(indexes, query) {
  const normalizedQuery = normalizeSearchText(query);
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];
  const termSet = new Set(terms);
  const phrase = terms.join(' ');
  const candidates = [];
  for (const index of indexes) {
    for (const chunk of index.chunks) {
      const normalizedText = normalizeSearchText(chunk.text);
      const tokens = tokenize(chunk.text);
      const matched = new Set(tokens.filter((term) => termSet.has(term)));
      if (!matched.size) continue;
      const documentTokens = new Set(tokenize(index.document));
      let score = (matched.size / terms.length) * 10;
      if (normalizedText.includes(phrase)) score += 20;
      score += [...matched].filter((term) => documentTokens.has(term)).length * 3;
      score += proximityScore(tokens, termSet);
      candidates.push({ document: index.document, fragmentId: chunk.id, text: String(chunk.text).slice(0, MAX_RESULT_TEXT), position: chunk.position, page: chunk.page ?? null, score: Number(score.toFixed(3)) });
    }
  }
  const unique = new Map();
  for (const result of candidates) {
    const key = `${result.document}\0${normalizeSearchText(result.text)}`;
    if (!unique.has(key) || unique.get(key).score < result.score) unique.set(key, result);
  }
  return [...unique.values()].sort((a, b) => b.score - a.score || a.document.localeCompare(b.document) || a.position - b.position).slice(0, MAX_RESULTS);
}

module.exports = { MAX_QUERY_LENGTH, MAX_INDEX_BYTES, MAX_RESULTS, MAX_RESULT_TEXT, normalizeSearchText, tokenize, validateManifest, readJsonLimited, loadPublishedIndexes, searchIndexes };
