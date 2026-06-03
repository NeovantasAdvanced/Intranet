import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseNewsEmailContent } from '../news-parser.mjs';

async function main() {
  const fixturePath = path.resolve('scripts/fixtures/news-briefing-sample.txt');
  const raw = await readFile(fixturePath, 'utf8');
  const parsed = parseNewsEmailContent(raw, {
    subject: 'Noticias relevantes de hoy - 03 junio 2026',
    fallbackDateIso: '2026-06-03T00:00:00.000Z',
    newsletterSource: 'Noticias relevantes de hoy',
  });
  const items = parsed.items;

  assert.ok(items.length >= 4, `Expected at least 4 news items, got ${items.length}.`);
  assert.ok(items.some((item) => item.category === 'Banca'), 'Expected a Banca category.');
  assert.ok(items.some((item) => item.category === 'Seguros'), 'Expected a Seguros category.');
  assert.ok(items.some((item) => item.category === 'Telco'), 'Expected a Telco category.');
  assert.ok(items.some((item) => item.source === 'Expansión'), 'Expected at least one item from Expansión.');
  assert.ok(items.some((item) => item.source === 'Cinco Días'), 'Expected at least one item from Cinco Días.');
  assert.ok(items.some((item) => /archive\.ph/i.test(item.url ?? '')), 'Expected an archive.ph URL.');

  console.log(`News parser OK: ${items.length} items.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
