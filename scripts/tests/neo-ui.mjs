import assert from 'node:assert/strict';
import fs from 'node:fs';

const chat = fs.readFileSync('src/components/neo/NeoChat.tsx', 'utf8');
const context = fs.readFileSync('src/context/NeoConversationContext.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const layout = fs.readFileSync('src/components/layout/AppLayout.tsx', 'utf8');

assert.match(chat, /Soy Neo/);
assert.match(context, /fetch\('\/api\/knowledge-ask'/);
assert.match(context, /messages:/);
assert.match(chat, /Fuentes documentales/);
assert.match(chat, /authChecked/);
assert.match(chat, /isAdminAllowed/);
assert.match(chat, /SUGGESTIONS/);
assert.match(chat, /Pregúntale a Neo/);
assert.match(chat, /Abrir Neo en pantalla completa/);
assert.match(app, /pathname === '\/neo'/);
assert.match(layout, /label: 'Neo'/);
assert.match(layout, /pushState/);
assert.match(context, /NeoConversationProvider/);
console.log('neo UI contract passed');
