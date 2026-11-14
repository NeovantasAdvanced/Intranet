const { BlobServiceClient } = require('@azure/storage-blob');

const ORIGINALS_PREFIX = 'originals/';

function getKnowledgeConfig(env = process.env) {
  const account = String(env.KNOWLEDGE_STORAGE_ACCOUNT ?? '').trim();
  const container = String(env.KNOWLEDGE_CONTAINER ?? '').trim();
  const sasToken = String(env.KNOWLEDGE_BLOB_SAS_TOKEN ?? '').trim();
  return { account, container, sasToken, configured: Boolean(account && container && sasToken) };
}

function createContainerClient(config = getKnowledgeConfig()) {
  if (!config.configured) throw new Error('Knowledge Blob Storage is not configured.');
  const endpoint = `https://${config.account}.blob.core.windows.net`;
  const serviceClient = new BlobServiceClient(`${endpoint}?${config.sasToken.replace(/^\?/, '')}`);
  return serviceClient.getContainerClient(config.container);
}

async function listKnowledgeDocuments({ containerClient = createContainerClient(), prefix = ORIGINALS_PREFIX } = {}) {
  const documents = [];
  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    if (blob.name && !blob.name.endsWith('/')) {
      documents.push({
        name: blob.name,
        size: blob.properties?.contentLength ?? null,
        lastModified: blob.properties?.lastModified?.toISOString?.() ?? null,
      });
    }
  }
  return documents;
}

async function downloadKnowledgeBlob(blobName, { containerClient = createContainerClient() } = {}) {
  if (!String(blobName).startsWith(ORIGINALS_PREFIX)) {
    throw new Error('Knowledge blobs must be inside originals/.');
  }
  const response = await containerClient.getBlobClient(blobName).download();
  return response.readableStreamBody;
}

module.exports = { ORIGINALS_PREFIX, getKnowledgeConfig, createContainerClient, listKnowledgeDocuments, downloadKnowledgeBlob };
