import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractNewsItemsFromHtml } from '../sync-outlook-news.mjs';

async function main() {
  const fixturePath = path.resolve('features/Noticias relevantes de hoy - 01 junio 2026.mht');
  const raw = await readFile(fixturePath, 'utf8');
  const items = extractNewsItemsFromHtml(raw, '2026-06-01T00:00:00.000Z');

  if (items.length !== 8) {
    throw new Error(`Expected 8 news items, got ${items.length}.`);
  }

  if (!items[0]?.title.includes('BBVA')) {
    throw new Error(`Expected first news item to mention BBVA, got "${items[0]?.title ?? ''}".`);
  }

  if (!items[0]?.href) {
    throw new Error('Expected first news item to include a link.');
  }

  console.log(`News HTML parser OK: ${items.length} items.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
