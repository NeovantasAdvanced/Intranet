import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('src/pages/KnowledgeAskPage.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const layout = fs.readFileSync('src/components/layout/AppLayout.tsx', 'utf8');

assert.match(page, /fetch\('\/api\/knowledge-ask'/);
assert.match(page, /credentials: 'same-origin'/);
assert.match(page, /authChecked/);
assert.match(page, /isAdminAllowed|isAdminUser|isOffice365AdminPrincipal/);
assert.match(page, /Consultando documentación/);
assert.match(page, /role="alert"/);
assert.match(page, /insufficient-evidence/);
assert.match(page, /Fuentes documentales/);
assert.match(page, /SUGGESTIONS/);
assert.match(app, /pathname === '\/knowledge-ask'/);
assert.match(layout, /Asistente IA/);
console.log('knowledge-ask UI contract passed');
