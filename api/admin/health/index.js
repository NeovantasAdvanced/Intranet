console.log('admin health function loaded');

module.exports = async function (context) {
  console.log('admin health handler invoked');
  context.res = {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      hasStorageConnection: Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage),
      nodeVersion: process.version,
    }),
  };
};
