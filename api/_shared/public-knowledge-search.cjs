const web = require('./public-knowledge.cjs');
const search = require('./knowledge-search.cjs');

async function loadPublishedPublicIndexes(containerClient) {
  let manifest;
  try {
    manifest = await web.readBlobJson(containerClient, web.CURRENT_MANIFEST);
  } catch (error) {
    if (error?.statusCode === 404 || error?.code === 'BlobNotFound' || error?.details?.errorCode === 'BlobNotFound') return null;
    throw error;
  }
  if (!manifest || manifest.schemaVersion !== web.PUBLIC_SCHEMA_VERSION || manifest.source !== 'corporate-web' || !Array.isArray(manifest.pages)) { const error = new Error('PUBLIC_MANIFEST_INVALID'); error.code = 'PUBLIC_MANIFEST_INVALID'; throw error; }
  const indexes = manifest.pages.map((page) => ({ schemaVersion: web.PUBLIC_SCHEMA_VERSION, document: page.url, title: page.title, category: page.category || 'other', language: page.language || 'unknown', url: page.url, sourceType: 'corporate-web', etag: manifest.candidateId, pageCount: 1, chunks: (page.chunks || []).map((chunk) => ({ ...chunk, document: page.url, page: null })) }));
  return { manifest, indexes };
}

function searchPublicIndexes(indexes, query) {
  const value = search.normalizeSearchText(query);
  const identity = /\b(que es|quienes somos|a que se dedica|presencia|paises|opera|diferencia)\b/.test(value);
  const services = /\b(servicios?|soluciones?|metodologia|capacidades?|economia conductual|como aplica)\b/.test(value);
  const retrievalQuery = `${query} ${identity ? 'quienes somos presencia internacional' : ''} ${services ? 'que hacemos servicios soluciones metodologia capacidades' : ''}`;
  const searchable = indexes.map((index) => ({ ...index, chunks: index.chunks.map((chunk) => ({ ...chunk, text: `${index.title || ''}\n${chunk.text}` })) }));
  return search.searchIndexes(searchable, retrievalQuery, { candidateLimit: 15, maxResults: 5, expandNeighbors: true }).map((result) => { const source = indexes.find((index) => index.document === result.document); const original = source?.chunks.find((chunk) => chunk.id === result.fragmentId); const title = web.cleanHtml(source?.title || result.document); const titleValue = search.normalizeSearchText(title); let boost = 0; if (identity && /quienes somos|about|presencia|neovantas/.test(titleValue)) boost += 10; if (services && /que hacemos|servicios|soluciones|metodolog|capacidades/.test(titleValue)) boost += 10; return { ...result, text: original?.text || result.text, score: result.score + boost, sourceType: 'corporate-web', title, url: source?.url || result.document }; }).sort((a, b) => b.score - a.score || a.document.localeCompare(b.document)).slice(0, 5);
}
module.exports = { loadPublishedPublicIndexes, searchPublicIndexes };
