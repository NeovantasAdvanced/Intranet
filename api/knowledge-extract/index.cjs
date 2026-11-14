const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');
const { getKnowledgeConfig } = require('../_shared/knowledge-blob.cjs');
const knowledgePdf = require('../_shared/knowledge-pdf.cjs');
const { TARGET_DOCUMENT } = knowledgePdf;

function send(context, status, body) {
  context.res = { status, headers: { 'content-type': 'application/json' }, body };
}

module.exports = async function (context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!principal) {
    send(context, 401, { ok: false, document: TARGET_DOCUMENT, extractionStatus: 'authentication-required' });
    return;
  }
  if (!isAdminPrincipal(principal)) {
    send(context, 403, { ok: false, document: TARGET_DOCUMENT, extractionStatus: 'admin-access-required' });
    return;
  }
  if (!getKnowledgeConfig().configured) {
    send(context, 503, { ok: false, document: TARGET_DOCUMENT, extractionStatus: 'storage-not-configured' });
    return;
  }

  try {
    const buffer = await knowledgePdf.downloadPdfBuffer();
    const extracted = await knowledgePdf.extractPdfText(buffer);
    send(context, 200, knowledgePdf.buildExtractionResponse(extracted));
  } catch (error) {
    const status = error?.code === 'PDF_TOO_LARGE' ? 413 : error?.code === 'PDF_NO_TEXT' ? 422 : error?.statusCode === 404 ? 404 : 503;
    const extractionStatus = error?.code === 'PDF_TOO_LARGE' ? 'pdf-too-large' : error?.code === 'PDF_NO_TEXT' ? 'no-extractable-text' : error?.statusCode === 404 ? 'document-not-found' : 'processing-error';
    context.log?.(`[knowledge-extract] ${extractionStatus}`);
    send(context, status, { ok: false, document: TARGET_DOCUMENT, extractionStatus });
  }
};
