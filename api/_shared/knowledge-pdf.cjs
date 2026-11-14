const {
  createContainerClient,
} = require('./knowledge-blob.cjs');

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PREVIEW_CHARACTERS = 1500;
const TARGET_DOCUMENT = 'originals/01_cultura_y_cumplimiento/Código Ético y de Conducta - NEOVANTAS.pdf';

function getPdfParser() {
  try {
    return require('pdf-parse');
  } catch {
    throw new Error('PDF_PARSER_UNAVAILABLE');
  }
}

async function streamToBuffer(readable, maxBytes = MAX_PDF_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of readable) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      const error = new Error('PDF_TOO_LARGE');
      error.code = 'PDF_TOO_LARGE';
      throw error;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total);
}

async function downloadPdfBuffer(blobName = TARGET_DOCUMENT, containerClient = createContainerClient()) {
  if (blobName !== TARGET_DOCUMENT) {
    const error = new Error('DOCUMENT_NOT_ALLOWED');
    error.code = 'DOCUMENT_NOT_ALLOWED';
    throw error;
  }
  const response = await containerClient.getBlobClient(blobName).download();
  if (response.contentLength > MAX_PDF_BYTES) {
    const error = new Error('PDF_TOO_LARGE');
    error.code = 'PDF_TOO_LARGE';
    throw error;
  }
  return streamToBuffer(response.readableStreamBody);
}

async function extractPdfText(pdfBuffer, parser = getPdfParser()) {
  const result = await parser(pdfBuffer);
  const text = String(result.text || '').trim();
  if (!text) {
    const error = new Error('PDF_NO_TEXT');
    error.code = 'PDF_NO_TEXT';
    throw error;
  }
  return { pageCount: result.numpages || 0, text };
}

function buildExtractionResponse({ pageCount, text }) {
  return {
    ok: true,
    document: TARGET_DOCUMENT,
    pageCount,
    extractedCharacters: text.length,
    extractionStatus: 'text-extracted',
    textPreview: text.slice(0, MAX_PREVIEW_CHARACTERS),
  };
}

module.exports = {
  MAX_PDF_BYTES,
  MAX_PREVIEW_CHARACTERS,
  TARGET_DOCUMENT,
  streamToBuffer,
  downloadPdfBuffer,
  extractPdfText,
  buildExtractionResponse,
};
