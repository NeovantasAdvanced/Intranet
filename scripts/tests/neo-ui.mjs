import assert from 'node:assert/strict';
import fs from 'node:fs';
const page = fs.readFileSync('src/pages/NeoPage.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const layout = fs.readFileSync('src/components/layout/AppLayout.tsx', 'utf8');
assert.match(page, /Soy Neo/); assert.match(page, /fetch\('\/api\/knowledge-ask'/); assert.match(page, /messagesForContext|messages:/); assert.match(page, /Fuentes documentales/); assert.match(page, /authChecked/); assert.match(page, /isAdminAllowed/); assert.match(page, /SUGGESTIONS/);
assert.match(app, /pathname === '\/neo'/); assert.match(layout, /label: 'Neo'/);
console.log('neo UI contract passed');
