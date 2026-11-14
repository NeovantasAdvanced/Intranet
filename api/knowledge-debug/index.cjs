const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');
const knowledgeIndex = require('../_shared/knowledge-index.cjs');
const search = require('../_shared/knowledge-search.cjs');
const { makeDocumentContext } = require('../_shared/knowledge-context.cjs');
const { getStorageErrorDetails } = require('../_shared/knowledge-publish.cjs');

const MAX_QUERY_LENGTH = 200;
const MAX_DOCUMENT_LENGTH = 500;
const MAX_FRAGMENT_ID_LENGTH = 100;
const MAX_FRAGMENT_TEXT = 1200;
const MAX_REPORT_CANDIDATES = 15;
const INDICATORS = ['gastos', 'compensacion', 'medios', 'equipos', 'jornada', 'solicitud', 'condiciones'];

function send(context, status, body) { context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store, no-cache, max-age=0' }, body }; }
function safeText(value, limit) { return String(value ?? '').slice(0, limit); }
function queryValue(req, name) { return typeof req?.query?.[name] === 'string' ? req.query[name].trim() : ''; }
function publicFragment(result) { return { document: result.document, fragmentId: result.fragmentId, position: result.position, page: result.page ?? null, score: result.score, preview: safeText(result.text, 300) }; }

module.exports = async function knowledgeDebug(context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!principal) return send(context, 401, { ok: false, debugStatus: 'authentication-required' });
  if (!isAdminPrincipal(principal)) return send(context, 403, { ok: false, debugStatus: 'admin-access-required' });
  const query = queryValue(req, 'q');
  const document = queryValue(req, 'document');
  const fragmentId = queryValue(req, 'fragmentId');
  const includeText = queryValue(req, 'includeText') === 'true';
  if (!query || query.length > MAX_QUERY_LENGTH) return send(context, 400, { ok: false, debugStatus: query ? 'query-too-long' : 'query-required' });
  if (document.length > MAX_DOCUMENT_LENGTH || fragmentId.length > MAX_FRAGMENT_ID_LENGTH) return send(context, 400, { ok: false, debugStatus: 'parameter-too-long' });
  if (includeText && !fragmentId) return send(context, 400, { ok: false, debugStatus: 'fragment-required' });
  if (!knowledgeIndex.getIndexReadStorageConfig().configured) return send(context, 503, { ok: false, debugStatus: 'storage-not-configured' });
  try {
    const client = knowledgeIndex.createIndexReadContainerClient();
    const { indexes } = await search.loadPublishedIndexes(client);
    const filteredIndexes = document ? indexes.filter((index) => index.document === document) : indexes;
    const totalFragments = filteredIndexes.reduce((total, index) => total + index.chunks.length, 0);
    const diagnostic = search.searchIndexes(filteredIndexes, query, { candidateLimit: MAX_REPORT_CANDIDATES, maxResults: 5, expandNeighbors: true, diagnostic: true });
    const contextInfo = makeDocumentContext(diagnostic.results, 12000);
    const selectedIds = new Set(contextInfo.selected.map((result) => `${result.document}\0${result.fragmentId}`));
    const candidateIds = new Set(diagnostic.candidates.map((result) => `${result.document}\0${result.fragmentId}`));
    const selected = contextInfo.selected.map((result) => ({ ...publicFragment(result), selectedForContext: true, reason: candidateIds.has(`${result.document}\0${result.fragmentId}`) ? 'selected-by-ranking' : 'included-by-continuity' }));
    const candidates = diagnostic.candidates.slice(0, MAX_REPORT_CANDIDATES).map((result) => ({ ...publicFragment(result), selectedForContext: selectedIds.has(`${result.document}\0${result.fragmentId}`), reason: selectedIds.has(`${result.document}\0${result.fragmentId}`) ? 'selected-by-ranking' : 'candidate-not-selected' }));
    const allText = filteredIndexes.flatMap((index) => index.chunks.map((chunk) => String(chunk.text ?? ''))).join(' ');
    const normalized = search.normalizeSearchText(allText);
    const indicators = Object.fromEntries(INDICATORS.map((term) => [term, normalized.includes(term)]));
    const response = { ok: true, query, document: document || null, documentCount: filteredIndexes.length, documents: filteredIndexes.map((index) => ({ document: index.document, totalFragments: index.chunks.length })), primaryDocument: diagnostic.primaryDocument, documentRanking: diagnostic.documents, totalFragments, candidates, selectedForContext: selected, contextCharacters: contextInfo.characters, contextTruncated: contextInfo.truncated, indicators };
    if (includeText) {
      const found = filteredIndexes.flatMap((index) => index.chunks).find((chunk) => chunk.id === fragmentId);
      if (!found) return send(context, 404, { ok: false, debugStatus: 'fragment-not-found' });
      response.fragment = { fragmentId: found.id, document: document || filteredIndexes.find((index) => index.chunks.some((chunk) => chunk.id === fragmentId))?.document || null, position: found.position, page: found.page ?? null, text: safeText(found.text, MAX_FRAGMENT_TEXT) };
    }
    return send(context, 200, response);
  } catch (error) {
    const debugStatus = error?.code === 'MANIFEST_INVALID' ? 'manifest-invalid' : error?.code === 'SEARCH_INDEX_INVALID' ? 'index-invalid' : error?.code === 'INDEX_TOO_LARGE' ? 'index-too-large' : 'storage-error';
    context.log?.(`[knowledge-debug] ${debugStatus === 'storage-error' ? JSON.stringify(getStorageErrorDetails(error, 'knowledge-debug-read')) : debugStatus}`);
    return send(context, 503, { ok: false, debugStatus });
  }
};

module.exports.MAX_FRAGMENT_TEXT = MAX_FRAGMENT_TEXT;
