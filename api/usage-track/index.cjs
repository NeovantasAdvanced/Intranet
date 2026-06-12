const { recordUsageEvent } = require('../_shared/usage-store.cjs');
const { getPrincipalFromRequest } = require('../_shared/auth.cjs');

function parseRequestBody(body) {
  if (!body) {
    return null;
  }

  if (typeof body === 'object' && !Buffer.isBuffer(body)) {
    return body;
  }

  const raw = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

module.exports = async function usageTrack(context, req) {
  context.log('[usage/track] request received');

  const payload = parseRequestBody(req.body);

  if (!payload) {
    context.res = {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Invalid JSON payload.' }),
    };
    return;
  }

  const principal = getPrincipalFromRequest(req);
  const userEmail = principal?.userDetails || 'anonymous';

  try {
    const entity = await recordUsageEvent(req, payload);
    context.res = {
      status: 204,
      body: '',
      headers: {
        'x-usage-user': userEmail,
        'x-usage-kind': entity.kind,
      },
    };
  } catch (error) {
    context.log.error('[usage/track] failed', error);
    context.res = {
      status: 503,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Usage tracking is unavailable.',
      }),
    };
  }
};
