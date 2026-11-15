const web = require('./public-knowledge.cjs');
const search = require('./knowledge-search.cjs');

async function loadPublishedPublicIndexes(containerClient) {
  const manifest = await web.readBlobJson(containerClient, web.CURRENT_MANIFEST);
  if (!manifest || manifest.schemaVersion !== web.PUBLIC_SCHEMA_VERSION || manifest.source !== 'corporate-web' || !Array.isArray(manifest.pages)) { const error = new Error('PUBLIC_MANIFEST_INVALID'); error.code = 'PUBLIC_MANIFEST_INVALID'; throw error; }
  const indexes = manifest.pages.map((page) => ({ schemaVersion: web.PUBLIC_SCHEMA_VERSION, document: page.url, title: page.title, url: page.url, sourceType: 'corporate-web', etag: manifest.candidateId, pageCount: 1, chunks: (page.chunks || []).map((chunk) => ({ ...chunk, document: page.url, page: null })) }));
  return { manifest, indexes };
}

function searchPublicIndexes(indexes, query) { return search.searchIndexes(indexes, query, { candidateLimit: 15, maxResults: 5, expandNeighbors: true }).map((result) => { const source = indexes.find((index) => index.document === result.document); return { ...result, sourceType: 'corporate-web', title: source?.title || result.document, url: source?.url || result.document }; }); }
module.exports = { loadPublishedPublicIndexes, searchPublicIndexes };
