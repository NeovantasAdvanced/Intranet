const crypto = require('node:crypto');
const dns = require('node:dns').promises;

const PUBLIC_SCHEMA_VERSION = '1.0';
const PUBLIC_PREFIX = 'public-knowledge/';
const CURRENT_MANIFEST = `${PUBLIC_PREFIX}current.json`;
const DEFAULT_ROOT = 'https://www.neovantas.com';
const ALLOWED_HOSTS = new Set(['www.neovantas.com', 'neovantas.com']);
const MAX_PAGES = 30;
const MAX_PAGE_BYTES = 1024 * 1024;
const MAX_DEPTH = 2;
const MAX_SITEMAPS = 20;
const MAX_DISCOVERED_URLS = 120;
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_BUDGET_MS = 35000;

function getConfig(env = process.env) {
  const rootUrl = String(env.PUBLIC_KNOWLEDGE_ROOT_URL || DEFAULT_ROOT).replace(/\/$/, '');
  const account = String(env.PUBLIC_KNOWLEDGE_STORAGE_ACCOUNT || '').trim();
  const container = String(env.PUBLIC_KNOWLEDGE_CONTAINER || 'neovantas-public-knowledge').trim();
  const readSas = String(env.PUBLIC_KNOWLEDGE_READ_SAS_TOKEN || '').trim();
  const writeSas = String(env.PUBLIC_KNOWLEDGE_WRITE_SAS_TOKEN || '').trim();
  const includePaths = String(env.PUBLIC_KNOWLEDGE_INCLUDE_PATHS || '').split(',').map((value) => value.trim()).filter(Boolean);
  return { rootUrl, account, container, readSas, writeSas, includePaths, maxPages: Math.min(Number(env.PUBLIC_KNOWLEDGE_MAX_PAGES || MAX_PAGES), MAX_PAGES), maxDepth: Math.min(Number(env.PUBLIC_KNOWLEDGE_MAX_DEPTH || MAX_DEPTH), MAX_DEPTH), maxPageBytes: Math.min(Number(env.PUBLIC_KNOWLEDGE_MAX_BYTES || MAX_PAGE_BYTES), MAX_PAGE_BYTES), timeoutMs: Math.min(Number(env.PUBLIC_KNOWLEDGE_TIMEOUT_MS || 10000), 30000), maxConcurrency: Math.max(1, Math.min(Number(env.PUBLIC_KNOWLEDGE_MAX_CONCURRENCY || DEFAULT_CONCURRENCY), 12)), budgetMs: Math.max(5000, Math.min(Number(env.PUBLIC_KNOWLEDGE_BUDGET_MS || DEFAULT_BUDGET_MS), 40000)), readConfigured: Boolean(account && container && readSas), writeConfigured: Boolean(account && container && writeSas), configured: Boolean(account && container && readSas && writeSas) };
}

function allowedHost(hostname) { return hostname === 'www.neovantas.com' || hostname === 'neovantas.com'; }
function isPrivateAddress(address) { return /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(address); }
async function validatePublicUrl(value, rootUrl = DEFAULT_ROOT, lookup = dns.lookup) {
  const url = new URL(value);
  const root = new URL(rootUrl);
  if (url.protocol !== 'https:' || !allowedHost(url.hostname) || !allowedHost(root.hostname)) throw new Error('PUBLIC_URL_NOT_ALLOWED');
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.some((item) => isPrivateAddress(item.address))) throw new Error('PUBLIC_URL_PRIVATE_ADDRESS');
  return url;
}

function parseRobots(text, rootUrl) {
  const sitemaps = [...String(text).matchAll(/^sitemap:\s*(\S+)/gim)].map((match) => match[1]);
  const disallow = [...String(text).matchAll(/^disallow:\s*(\S*)/gim)].map((match) => match[1]);
  return { sitemaps: sitemaps.filter((url) => { try { const parsed = new URL(url); return parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname.toLowerCase()); } catch { return false; } }), disallow };
}
function robotsAllows(pathname, robots) { return !robots.disallow.some((rule) => rule && pathname.startsWith(rule.replace(/\*/g, ''))); }
function parseSitemapDocument(xml) {
  const value = String(xml);
  const kind = /<sitemapindex\b/i.test(value) ? 'sitemapindex' : /<urlset\b/i.test(value) ? 'urlset' : 'unknown';
  const urls = [...value.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].trim()).filter(Boolean);
  return { kind, urls };
}
function parseSitemap(xml) { return parseSitemapDocument(xml).urls; }
function isAllowedPageUrl(value) {
  try {
    const url = new URL(value);
    if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase()) || url.protocol !== 'https:') return false;
    if (/\/wp-content\/uploads\//i.test(url.pathname)) return false;
    if (/\.(?:png|jpe?g|svg|webp|gif|pdf|xml|zip|css|js|woff2?|ttf|ico)(?:$|\?)/i.test(url.pathname)) return false;
    return true;
  } catch { return false; }
}
function prefilterUrl(value, config = {}, sourceSitemap = '') {
  try {
    const url = new URL(value); const path = url.pathname.toLowerCase(); const included = (config.includePaths || []).some((prefix) => path.startsWith(prefix.toLowerCase()));
    if (included) return { allowed: true, reason: null };
    if (/post-sitemap/i.test(sourceSitemap)) return { allowed: false, reason: 'blog-sitemap' };
    if (/(?:^|\/)(?:en|eng)(?:\/|$)/i.test(path)) return { allowed: false, reason: 'english-page' };
    if (/(?:privacy|privacidad|cookie|cookies|legal|terms|terminos|términos|aviso-legal|contact|contacto)/i.test(path)) return { allowed: false, reason: 'legal-page' };
    if (/(?:^|\/)blog(?:\/|$)|\/\d{4}\/\d{2}\//i.test(path)) return { allowed: false, reason: 'blog-page' };
    return { allowed: true, reason: null };
  } catch { return { allowed: false, reason: 'invalid-url' }; }
}
function sitemapPriority(value) {
  const path = new URL(value).pathname.toLowerCase();
  if (path.includes('page-sitemap')) return 0;
  if (path.includes('post-sitemap')) return 2;
  if (path.includes('category-sitemap')) return 3;
  return 1;
}
function cleanHtml(html) {
  return String(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>|<form[\s\S]*?<\/form>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&([a-z]+);/gi, (_, name) => ({ ndash: '–', mdash: '—', laquo: '«', raquo: '»', hellip: '…' }[name.toLowerCase()] || `&${name};`)).replace(/(?:Close Search Menu|Portada\s*[»›]|Inicio\s*[»›])/gi, ' ').replace(/\s+/g, ' ').trim();
}
function extractPage(html, url, syncedAt = new Date().toISOString()) {
  const title = (String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
  const headings = [...String(html).matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((match) => cleanHtml(match[1])).filter(Boolean);
  const text = cleanHtml(html);
  const date = String(html).match(/<meta[^>]+(?:article:published_time|datePublished)[^>]+content=["']([^"']+)/i)?.[1] || String(html).match(/<time[^>]+datetime=["']([^"']+)/i)?.[1] || null;
  return { title, url, headings, text, publishedAt: date, syncedAt };
}
function hasUsefulPageContent(page) {
  if (!page || !page.title || page.title === page.url || page.text.length < 80) return false;
  const urlLike = (page.text.match(/https?:\/\/|\/wp-content\/|\.(?:png|jpe?g|svg|webp|gif|xml)\b/gi) || []).length;
  const words = page.text.split(/\s+/).filter(Boolean).length;
  return words >= 10 && urlLike < Math.max(3, Math.floor(words / 8));
}
function classifyPage(page, sourcePriority = 1, config = {}) {
  const path = new URL(page.url).pathname.toLowerCase();
  const included = (config.includePaths || []).some((prefix) => path.startsWith(prefix.toLowerCase()));
  const legal = /(?:privacy|privacidad|cookie|cookies|legal|terms|terminos|términos|aviso-legal|contact|contacto)/i.test(path);
  const blog = /(?:^|\/)blog(?:\/|$)|\/\d{4}\/\d{2}\//i.test(path) || sourcePriority >= 2;
  const english = /(?:^|\/)(?:en|eng)(?:\/|$)/i.test(path) || /\b(?:services|solutions|industries|about us|contact us)\b/i.test(page.title);
  const category = blog ? 'blog' : legal ? 'legal' : /(?:service|servicio|solution|solucion|sector|industry|industria|method|metodolog|case|caso|about|quienes|somos|capacit|behavioral)/i.test(`${path} ${page.title} ${page.headings.join(' ')}`) ? 'corporate' : 'other';
  let reason = null;
  if (legal && !included) reason = 'legal-page';
  if (blog && !included) reason = 'blog-page';
  const score = (category === 'corporate' ? 100 : category === 'other' ? 50 : 10) + (english ? 0 : 15) + (sourcePriority === 0 ? 10 : 0) - (blog ? 20 : 0);
  return { eligible: !reason, reason, category, language: english ? 'en' : 'es', score, isBlog: blog, included };
}
function contentFingerprint(text) { return crypto.createHash('sha256').update(String(text).toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex'); }
function splitText(text, size = 1200, overlap = 150) { const chunks = []; let start = 0; while (start < text.length) { const end = Math.min(start + size, text.length); const value = text.slice(start, end).trim(); if (value) chunks.push({ id: crypto.createHash('sha256').update(`${start}\0${value}`).digest('hex').slice(0, 24), position: start, text: value }); if (end >= text.length) break; start = end - overlap; } return chunks; }
function buildCandidate(pages, syncedAt = new Date().toISOString()) { return { schemaVersion: PUBLIC_SCHEMA_VERSION, syncedAt, source: 'corporate-web', pageCount: pages.length, pages: pages.map((page) => ({ title: page.title, url: page.url, headings: page.headings, category: page.category, language: page.language, syncedAt: page.syncedAt, chunks: splitText(page.text) })) }; }
function createBlobClient(config, sas) { let BlobServiceClient; try { ({ BlobServiceClient } = require('@azure/storage-blob')); } catch { throw new Error('BLOB_SDK_UNAVAILABLE'); } const endpoint = `https://${config.account}.blob.core.windows.net`; return new BlobServiceClient(`${endpoint}?${sas.replace(/^\?/, '')}`).getContainerClient(config.container); }
async function readBlobJson(client, name) { const response = await client.getBlobClient(name).download(); const chunks = []; for await (const chunk of response.readableStreamBody) chunks.push(Buffer.from(chunk)); return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
async function fetchAllowed(url, config, fetchImpl = globalThis.fetch, lookup = dns.lookup) { let current = await validatePublicUrl(url, config.rootUrl, lookup); for (let attempt = 0; attempt <= 3; attempt += 1) { const response = await fetchImpl(current.href, { redirect: 'manual', signal: AbortSignal.timeout(config.timeoutMs) }); if (response.status >= 300 && response.status < 400 && response.headers?.get('location')) { current = await validatePublicUrl(new URL(response.headers.get('location'), current).href, config.rootUrl, lookup); continue; } if (!response.ok) throw new Error(`PUBLIC_HTTP_${response.status}`); const contentLength = Number(response.headers?.get('content-length') || 0); if (contentLength > config.maxPageBytes) throw new Error('PUBLIC_PAGE_TOO_LARGE'); const body = await response.text(); if (Buffer.byteLength(body, 'utf8') > config.maxPageBytes) throw new Error('PUBLIC_PAGE_TOO_LARGE'); return { url: current.href, body, contentType: response.headers?.get('content-type') || '' }; } throw new Error('PUBLIC_TOO_MANY_REDIRECTS'); }

module.exports = { PUBLIC_SCHEMA_VERSION, PUBLIC_PREFIX, CURRENT_MANIFEST, MAX_PAGES, MAX_PAGE_BYTES, MAX_DEPTH, MAX_SITEMAPS, MAX_DISCOVERED_URLS, DEFAULT_CONCURRENCY, DEFAULT_BUDGET_MS, getConfig, allowedHost, isPrivateAddress, validatePublicUrl, parseRobots, robotsAllows, parseSitemap, parseSitemapDocument, isAllowedPageUrl, prefilterUrl, sitemapPriority, cleanHtml, extractPage, hasUsefulPageContent, classifyPage, contentFingerprint, splitText, buildCandidate, createBlobClient, readBlobJson, fetchAllowed };
