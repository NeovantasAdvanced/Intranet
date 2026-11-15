const assert = require('node:assert/strict');
const web = require('../_shared/public-knowledge.cjs');
const sync = require('../knowledge-web-sync/index.cjs');

(async () => {
  assert.equal(web.prefilterUrl('https://www.neovantas.com/en/services', {}).reason, 'english-page');
  assert.equal(web.prefilterUrl('https://www.neovantas.com/blog/old', {}).reason, 'blog-page');
  assert.equal(web.prefilterUrl('https://www.neovantas.com/blog/old', { includePaths: ['/blog/old'] }).allowed, true);
  const oldValidate = web.validatePublicUrl; const oldFetch = web.fetchAllowed; let active = 0; let peak = 0; let calls = 0;
  web.validatePublicUrl = async (url) => new URL(url);
  web.fetchAllowed = async (url) => { calls += 1; active += 1; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 3)); active -= 1; return { url, body: '<html><head><title>Servicios</title></head><body><main>Contenido corporativo útil y suficientemente extenso para la prueba, con servicios, capacidades, metodologías y resultados para clientes de distintos sectores.</main></body></html>', contentType: 'text/html' }; };
  try {
    const items = Array.from({ length: 12 }, (_, index) => ({ url: `https://www.neovantas.com/servicios/${index}`, sourcePriority: 0 }));
    const results = await sync.processPages(items, { includePaths: [], maxConcurrency: 6, timeoutMs: 1000 }, { disallow: [] }, Date.now() + 3000);
    assert.equal(results.filter((item) => item.type === 'page').length, 12); assert.ok(peak <= 6); assert.equal(calls, 12);
    const excluded = await sync.processPages([{ url: 'https://www.neovantas.com/en/services', sourcePriority: 0 }, ...items.slice(0, 1)], { includePaths: [], maxConcurrency: 6, timeoutMs: 1000 }, { disallow: [] }, Date.now() + 3000);
    assert.equal(excluded[0].reason, 'english-page'); assert.equal(calls, 13);
    const pending = await sync.processPages(items, { includePaths: [], maxConcurrency: 6, timeoutMs: 1000 }, { disallow: [] }, Date.now() - 1);
    assert.ok(pending.every((item) => item.type === 'pending'));
    const oldSitemapFetch = web.fetchAllowed;
    web.fetchAllowed = async (url) => {
      if (url.endsWith('page-sitemap.xml')) return { body: '<urlset><url><loc>https://www.neovantas.com/servicios</loc></url></urlset>' };
      if (url.endsWith('post-sitemap.xml')) return { body: `<urlset>${Array.from({ length: 130 }, (_, index) => `<url><loc>https://www.neovantas.com/blog/${index}</loc></url>`).join('')}</urlset>` };
      return { body: '<urlset></urlset>' };
    };
    const discovery = await sync.discoverPages({ includePaths: [], maxDepth: 2, timeoutMs: 1000 }, { sitemaps: ['https://www.neovantas.com/post-sitemap.xml', 'https://www.neovantas.com/page-sitemap.xml', 'https://www.neovantas.com/category-sitemap.xml'] });
    assert.equal(discovery.items.length, 1); assert.equal(discovery.items[0].url, 'https://www.neovantas.com/servicios'); assert.equal(discovery.preExclusions.length, 130);
    web.fetchAllowed = oldSitemapFetch;
  } finally { web.validatePublicUrl = oldValidate; web.fetchAllowed = oldFetch; }
  console.log('knowledge-web-sync performance tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
