import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const fixturePath = path.resolve('scripts/fixtures/news-briefing-sample.txt');
const execFileAsync = promisify(execFile);
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'neovantas-news-sync-'));
const outputPath = path.join(tempDir, 'nested', 'news.json');
process.env.NEWS_OUTPUT_PATH = outputPath;
process.env.NEWS_HTML_FIXTURE_PATH = fixturePath;
process.env.NEWS_SOURCE = 'Noticias relevantes de hoy';
process.env.NEWS_MAX_ITEMS = '1000';

try {
  const sync = await import('../sync-outlook-news.mjs');

  assert.deepEqual(await sync.readExistingNews(), [], 'missing file should be treated as an empty dataset');
  await sync.main();
  const initial = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.ok(initial.length > 0, 'fixture sync should create the output file');

  const preserved = [{ id: 'existing', date: '2026-11-01', source: 'Manual' }];
  await writeFile(outputPath, JSON.stringify(preserved), 'utf8');
  assert.deepEqual(await sync.readExistingNews(), preserved, 'valid existing file should be preserved when read');

  delete process.env.NEWS_HTML_FIXTURE_PATH;
  delete process.env.NEWS_MAILBOX_USER_ID;
  await assert.rejects(
    () => execFileAsync(process.execPath, ['scripts/sync-outlook-news.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, NEWS_OUTPUT_PATH: outputPath, NEWS_HTML_FIXTURE_PATH: '', NEWS_MAILBOX_USER_ID: '' },
    }),
    /Missing NEWS_MAILBOX_USER_ID/,
  );
  assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), preserved, 'Outlook failure must not overwrite existing news');

  console.log('news sync tests passed');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
