const assert = require('node:assert/strict');
const {
  MAX_PDF_BYTES,
  MAX_PREVIEW_CHARACTERS,
  TARGET_DOCUMENT,
  streamToBuffer,
  downloadPdfBuffer,
  extractPdfText,
  buildExtractionResponse,
} = require('../_shared/knowledge-pdf.cjs');

(async () => {
  assert.deepEqual(await streamToBuffer([Buffer.from('abc')]), Buffer.from('abc'));
  await assert.rejects(() => streamToBuffer([Buffer.alloc(MAX_PDF_BYTES + 1)]), /PDF_TOO_LARGE/);
  let requested;
  const client = { getBlobClient(name) { requested = name; return { download: async () => ({ contentLength: 3, readableStreamBody: [Buffer.from('pdf')] }) }; } };
  assert.deepEqual(await downloadPdfBuffer(TARGET_DOCUMENT, client), Buffer.from('pdf'));
  assert.equal(requested, TARGET_DOCUMENT);
  await assert.rejects(() => downloadPdfBuffer('originals/other.pdf', client), /DOCUMENT_NOT_ALLOWED/);
  assert.deepEqual(await extractPdfText(Buffer.from('x'), async () => ({ numpages: 2, text: '  hello  ' })), { pageCount: 2, text: 'hello' });
  await assert.rejects(() => extractPdfText(Buffer.from('x'), async () => ({ numpages: 1, text: '' })), /PDF_NO_TEXT/);
  const response = buildExtractionResponse({ pageCount: 1, text: 'x'.repeat(2000) });
  assert.equal(response.textPreview.length, MAX_PREVIEW_CHARACTERS);
  assert.equal(response.document, TARGET_DOCUMENT);
  console.log('knowledge-pdf tests passed');
})();
