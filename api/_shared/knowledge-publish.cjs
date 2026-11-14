const { getIndexBlobName, SCHEMA_VERSION } = require('./knowledge-index.cjs');

const CURRENT_MANIFEST = 'knowledge-index/current.json';

function validateIndex(index, document, etag) {
  return Boolean(
    index &&
    index.schemaVersion === SCHEMA_VERSION &&
    index.document === document &&
    index.etag === etag &&
    Number.isInteger(index.pageCount) &&
    Number.isInteger(index.extractedCharacters) &&
    Array.isArray(index.chunks) &&
    index.chunks.length > 0 &&
    index.chunks.every((chunk) => chunk && typeof chunk.id === 'string' && typeof chunk.text === 'string' && chunk.text.trim()),
  );
}

async function readJson(containerClient, blobName) {
  const response = await containerClient.getBlobClient(blobName).download();
  const chunks = [];
  for await (const chunk of response.readableStreamBody) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function buildCurrentManifest({ documents, indexContainerClient }) {
  const entries = {};
  const pending = [];
  for (const document of documents) {
    const blobName = getIndexBlobName({ document: document.name, etag: document.etag });
    try {
      const index = await readJson(indexContainerClient, blobName);
      if (!validateIndex(index, document.name, document.etag)) {
        pending.push({ document: document.name, reason: 'invalid-index' });
        continue;
      }
      entries[document.name] = { index: blobName, etag: document.etag, indexedAt: index.indexedAt };
    } catch (error) {
      if (error?.statusCode === 404) pending.push({ document: document.name, reason: 'index-not-found' });
      else if (error instanceof SyntaxError) pending.push({ document: document.name, reason: 'invalid-index-json' });
      else throw error;
    }
  }
  if (pending.length) {
    const error = new Error('INDEX_INCOMPLETE');
    error.code = 'INDEX_INCOMPLETE';
    error.pending = pending;
    throw error;
  }
  return { schemaVersion: SCHEMA_VERSION, publishedAt: new Date().toISOString(), documents: entries };
}

function getStorageErrorDetails(error, operation) {
  return {
    operation,
    statusCode: error?.statusCode ?? null,
    code: error?.code ?? null,
    errorCode: error?.details?.errorCode ?? null,
    requestId: error?.requestId ?? error?.details?.requestId ?? null,
  };
}

async function publishCurrentManifest({ readContainerClient, writeContainerClient, manifest }) {
  const writeBlobClient = writeContainerClient.getBlockBlobClient(CURRENT_MANIFEST);
  const body = Buffer.from(JSON.stringify(manifest));
  try {
    await writeBlobClient.uploadData(body, { conditions: { ifNoneMatch: '*' }, blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' } });
    return { created: true, updated: false };
  } catch (error) {
    if (!(error?.statusCode === 412 || error?.code === 'BlobAlreadyExists')) throw error;
    const readBlobClient = readContainerClient.getBlobClient(CURRENT_MANIFEST);
    const properties = await readBlobClient.getProperties();
    try {
      await writeBlobClient.uploadData(body, { conditions: { ifMatch: properties.etag }, blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' } });
      return { created: false, updated: true };
    } catch (updateError) {
      if (updateError?.statusCode === 412) {
        const conflict = new Error('MANIFEST_CONFLICT');
        conflict.code = 'MANIFEST_CONFLICT';
        throw conflict;
      }
      throw updateError;
    }
  }
}

module.exports = { CURRENT_MANIFEST, validateIndex, buildCurrentManifest, publishCurrentManifest, getStorageErrorDetails };
