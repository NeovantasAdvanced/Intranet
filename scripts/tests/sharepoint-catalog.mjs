import assert from 'node:assert/strict';
import fs from 'node:fs';

const catalog = JSON.parse(fs.readFileSync('api/data/sharepointCatalog.json', 'utf8'));
assert.equal(catalog.repositories.length, 2);
assert.equal(catalog.resources.length, 104);

const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const visible = catalog.resources.filter((item) => {
  const text = [item.title, item.description, item.repository, item.category, item.parentTitle, item.path, item.status, ...(item.tags ?? [])].filter(Boolean).join(' ');
  return normalize(text).includes('') && (item.scope === 'team' || item.scope === 'projects');
});
assert.equal(visible.length, 104, 'los filtros iniciales deben conservar todos los recursos');
assert.ok(visible.some((item) => item.scope === 'projects'));
assert.ok(visible.some((item) => item.category && normalize(item.category).includes('ficha')));
assert.ok(visible.some((item) => item.category && normalize(item.category).includes('documento final')));
assert.match(fs.readFileSync('src/pages/HomeDashboard.tsx', 'utf8'), /\[searchQuery, assistants, news, events, documents, sharePointResources, apps, supportAst\]/);
assert.match(fs.readFileSync('src/pages/HomeDashboard.tsx', 'utf8'), /\[sharePointResources\]/);
console.log('sharepoint catalog integration test passed');
