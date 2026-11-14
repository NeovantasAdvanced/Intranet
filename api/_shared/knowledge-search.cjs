const { SCHEMA_VERSION } = require('./knowledge-index.cjs');
const { CURRENT_MANIFEST, validateIndex } = require('./knowledge-publish.cjs');

const MAX_QUERY_LENGTH = 200;
const MAX_INDEX_BYTES = 2 * 1024 * 1024;
const MAX_RESULTS = 5;
const DEFAULT_CANDIDATE_LIMIT = 15;
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

function contentQualityScore(text) {
  const value = normalizeSearchText(text);
  const headingNoise = /(^| )(indice|contenido|introduccion|objetivo|alcance|version|revision|aprobacion|tabla de contenido)( |$)/.test(value);
  const substantive = /(condicion|condiciones|solicitud|solicitar|gasto|gastos|jornada|horario|obligacion|responsabilidad|procedimiento|medios|compensacion|aplica)/.test(value);
  return (substantive ? 5 : 0) - (headingNoise ? 8 : 0);
}

function searchIndexes(indexes, query, options = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];
  const termSet = new Set(terms);
  const phrase = terms.join(' ');
  const candidateLimit = Math.min(Math.max(Number(options.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT), MAX_RESULTS), 50);
  const resultLimit = Math.min(Math.max(Number(options.maxResults ?? MAX_RESULTS), 1), 50);
  const expandNeighbors = options.expandNeighbors === true;
  const candidates = [];
  for (const [indexNumber, index] of indexes.entries()) {
    for (const [chunkNumber, chunk] of index.chunks.entries()) {
      const normalizedText = normalizeSearchText(chunk.text);
      const tokens = tokenize(chunk.text);
      const matched = new Set(tokens.filter((term) => termSet.has(term)));
      if (!matched.size) continue;
      const documentTokens = new Set(tokenize(index.document));
      let score = (matched.size / terms.length) * 10;
      if (normalizedText.includes(phrase)) score += 20;
      score += [...matched].filter((term) => documentTokens.has(term)).length * 3;
      score += proximityScore(tokens, termSet);
      score += contentQualityScore(chunk.text);
      candidates.push({ indexNumber, chunkNumber, document: index.document, fragmentId: chunk.id, text: String(chunk.text).slice(0, MAX_RESULT_TEXT), position: chunk.position, page: chunk.page ?? null, score: Number(score.toFixed(3)), matchedTerms: [...matched] });
    }
  }
  const unique = new Map();
  for (const result of candidates) {
    const key = `${result.document}\0${normalizeSearchText(result.text)}`;
    if (!unique.has(key) || unique.get(key).score < result.score) unique.set(key, result);
  }
  const documentStats = new Map();
  for (const result of unique.values()) {
    const current = documentStats.get(result.document) ?? { maxScore: 0, terms: new Set(), count: 0, indexNumber: result.indexNumber };
    current.maxScore = Math.max(current.maxScore, result.score);
    result.matchedTerms.forEach((term) => current.terms.add(term));
    current.count += 1;
    documentStats.set(result.document, current);
  }
  const queryTerms = new Set(terms);
  const documentRanking = [...documentStats.entries()].map(([document, stats]) => {
    const titleTerms = new Set(tokenize(document));
    const titleMatches = [...queryTerms].filter((term) => titleTerms.has(term)).length;
    return { document, indexNumber: stats.indexNumber, score: stats.maxScore + titleMatches * 5 + Math.min(stats.count, 3), coverage: stats.terms.size / terms.length };
  }).sort((a, b) => b.score - a.score || b.coverage - a.coverage || a.document.localeCompare(b.document));
  const primary = documentRanking[0];
  const secondaryThreshold = primary ? primary.score * 0.78 : 0;
  const ranked = [...unique.values()].sort((a, b) => {
    const aDoc = documentRanking.find((item) => item.document === a.document);
    const bDoc = documentRanking.find((item) => item.document === b.document);
    const aPriority = aDoc?.document === primary?.document ? 2 : aDoc?.score >= secondaryThreshold ? 1 : 0;
    const bPriority = bDoc?.document === primary?.document ? 2 : bDoc?.score >= secondaryThreshold ? 1 : 0;
    return bPriority - aPriority || (bDoc?.score ?? 0) - (aDoc?.score ?? 0) || b.score - a.score || a.position - b.position;
  }).slice(0, candidateLimit);
  if (expandNeighbors && ranked.length) {
    const expanded = new Map(ranked.map((result) => [`${result.document}\0${result.fragmentId}`, result]));
    for (const result of ranked.filter((item) => item.document === primary?.document).slice(0, 5)) {
      const index = indexes[result.indexNumber];
      for (const neighborNumber of [result.chunkNumber - 1, result.chunkNumber + 1]) {
        const neighbor = index?.chunks?.[neighborNumber];
        if (!neighbor) continue;
        const key = `${index.document}\0${neighbor.id}`;
        if (!expanded.has(key)) expanded.set(key, { indexNumber: result.indexNumber, chunkNumber: neighborNumber, document: index.document, fragmentId: neighbor.id, text: String(neighbor.text).slice(0, MAX_RESULT_TEXT), position: neighbor.position, page: neighbor.page ?? null, score: Number((result.score - 1).toFixed(3)), neighbor: true });
      }
    }
    const results = [...expanded.values()].sort((a, b) => {
      const aPrimary = a.document === primary?.document ? 1 : 0;
      const bPrimary = b.document === primary?.document ? 1 : 0;
      return bPrimary - aPrimary || b.score - a.score || a.position - b.position;
    }).slice(0, resultLimit).map(({ indexNumber: _i, chunkNumber: _c, neighbor: _n, matchedTerms: _m, ...result }) => result);
    return options.diagnostic ? { candidates: ranked.map(({ indexNumber: _i, chunkNumber: _c, matchedTerms: _m, ...result }) => result), documents: documentRanking, primaryDocument: primary?.document ?? null, results } : results;
  }
  const results = ranked.slice(0, resultLimit).map(({ indexNumber: _i, chunkNumber: _c, matchedTerms: _m, ...result }) => result);
  return options.diagnostic ? { candidates: ranked.map(({ indexNumber: _i, chunkNumber: _c, matchedTerms: _m, ...result }) => result), documents: documentRanking, primaryDocument: primary?.document ?? null, results } : results;
}

module.exports = { MAX_QUERY_LENGTH, MAX_INDEX_BYTES, MAX_RESULTS, MAX_RESULT_TEXT, DEFAULT_CANDIDATE_LIMIT, normalizeSearchText, tokenize, validateManifest, readJsonLimited, loadPublishedIndexes, searchIndexes };
