const assert = require('node:assert/strict');
const web = require('../_shared/public-knowledge.cjs');
const sync = require('../knowledge-web-sync/index.cjs');
const publish = require('../knowledge-web-publish/index.cjs');
const review = require('../knowledge-web-review/index.cjs');
const publicSearch = require('../_shared/public-knowledge-search.cjs');

const admin = Buffer.from(JSON.stringify({ userDetails: 'admin@neovantas.com', userRoles: ['admin'] })).toString('base64');
const html = '<html><head><title>Servicios</title></head><body><nav>Menu</nav><h1>Servicios</h1><main>Neovantas ayuda a mejorar experiencias y resultados de negocio con Behavioral Economics y analítica avanzada.</main><form>private</form><footer>Cookies</footer></body></html>';
function ctx() { return { res: null, logs: [], log(value) { this.logs.push(value); } }; }

(async () => {
  assert.equal(web.cleanHtml(html).includes('Menu'), false); assert.equal(web.cleanHtml(html).includes('Cookies'), false); assert.equal(web.extractPage(html, 'https://www.neovantas.com/servicios').title, 'Servicios');
  await assert.rejects(() => web.validatePublicUrl('https://evil.example/'), /PUBLIC_URL_NOT_ALLOWED/);
  const missingManifestClient = { getBlobClient: () => ({ download: async () => { const error = new Error('missing'); error.statusCode = 404; throw error; } }) };
  assert.equal(await publicSearch.loadPublishedPublicIndexes(missingManifestClient), null);
  const forbiddenManifestClient = { getBlobClient: () => ({ download: async () => { const error = new Error('forbidden'); error.statusCode = 403; throw error; } }) };
  await assert.rejects(() => publicSearch.loadPublishedPublicIndexes(forbiddenManifestClient), (error) => error.statusCode === 403);
  const oldFetch = global.fetch; const oldClient = web.createBlobClient; const oldValidate = web.validatePublicUrl; const oldEnv = { ...process.env }; const blobs = {};
  process.env.PUBLIC_KNOWLEDGE_STORAGE_ACCOUNT = 'test'; process.env.PUBLIC_KNOWLEDGE_CONTAINER = 'public'; process.env.PUBLIC_KNOWLEDGE_READ_SAS_TOKEN = 'read'; process.env.PUBLIC_KNOWLEDGE_WRITE_SAS_TOKEN = 'write';
  web.createBlobClient = () => ({ getBlockBlobClient: (name) => ({ uploadData: async (data) => { blobs[name] = JSON.parse(data.toString()); } }), getBlobClient: (name) => ({ download: async () => ({ readableStreamBody: [Buffer.from(JSON.stringify(blobs[name]))] }), getProperties: async () => { const error = new Error('not found'); error.statusCode = 404; throw error; } }) });
  web.validatePublicUrl = async (value) => new URL(value);
  global.fetch = async (url) => { const body = url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /\nSitemap: https://www.neovantas.com/sitemap.xml' : url.endsWith('sitemap.xml') ? '<urlset><url><loc>https://www.neovantas.com/servicios</loc></url></urlset>' : html; return { ok: true, status: 200, headers: { get: () => null }, text: async () => body }; };
  try {
    const syncContext = ctx(); await sync(syncContext, { headers: { 'x-ms-client-principal': admin } }); assert.equal(syncContext.res.status, 200); assert.equal(syncContext.res.body.pageCount, 1); const id = syncContext.res.body.candidateId; assert.ok(id);
    const publishContext = ctx(); await publish(publishContext, { headers: { 'x-ms-client-principal': admin }, body: { candidateId: id } }); assert.equal(publishContext.res.status, 200); assert.equal(publishContext.res.body.publishStatus, 'published'); assert.ok(blobs['public-knowledge/current.json']);
    const reviewContext = ctx(); await review(reviewContext, { headers: { 'x-ms-client-principal': admin }, query: { candidateId: id } }); assert.equal(reviewContext.res.status, 200); assert.equal(reviewContext.res.body.pages[0].title, 'Servicios'); assert.equal(reviewContext.res.body.pages[0].preview.length, 1);
    const published = await publicSearch.loadPublishedPublicIndexes({ getBlobClient: () => ({ download: async () => ({ readableStreamBody: [Buffer.from(JSON.stringify(blobs['public-knowledge/current.json']))] }) }) });
    const matches = publicSearch.searchPublicIndexes(published.indexes, 'servicios Behavioral Economics'); assert.ok(matches.length > 0); assert.equal(matches[0].sourceType, 'corporate-web'); assert.equal(matches[0].url, 'https://www.neovantas.com/servicios');
  } finally { global.fetch = oldFetch; web.createBlobClient = oldClient; web.validatePublicUrl = oldValidate; for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key]; for (const [key, value] of Object.entries(oldEnv)) process.env[key] = value; }
  console.log('public-knowledge tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
