const assert = require('node:assert/strict');
const { ORIGINALS_PREFIX, getKnowledgeConfig, listKnowledgeDocuments, downloadKnowledgeBlob } = require('../_shared/knowledge-blob.cjs');

async function run() {
  assert.equal(getKnowledgeConfig({}).configured, false);
  assert.equal(getKnowledgeConfig({ KNOWLEDGE_STORAGE_ACCOUNT: 'neovantasintranet', KNOWLEDGE_CONTAINER: 'neovantas-knowledge', KNOWLEDGE_BLOB_SAS_TOKEN: 'sv=test' }).configured, true);
  const fakeContainer = {
    async *listBlobsFlat({ prefix }) {
      assert.equal(prefix, ORIGINALS_PREFIX);
      yield { name: 'originals/a.pdf', properties: { contentLength: 10, lastModified: new Date('2026-01-01') } };
      yield { name: 'originals/', properties: {} };
    },
    getBlobClient(name) {
      return { async download() { assert.equal(name, 'originals/a.pdf'); return { readableStreamBody: 'stream-placeholder' }; } };
    },
  };
  assert.deepEqual(await listKnowledgeDocuments({ containerClient: fakeContainer }), [{ name: 'originals/a.pdf', size: 10, lastModified: '2026-01-01T00:00:00.000Z' }]);
  assert.equal(await downloadKnowledgeBlob('originals/a.pdf', { containerClient: fakeContainer }), 'stream-placeholder');
  await assert.rejects(() => downloadKnowledgeBlob('processed/a.json', { containerClient: fakeContainer }));
}

run().then(() => console.log('knowledge-blob tests passed'));
