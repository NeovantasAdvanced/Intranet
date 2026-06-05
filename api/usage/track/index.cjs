const { recordUsageEvent } = require('../../_shared/usage-store.cjs');
const { getPrincipalFromRequest } = require('../../_shared/auth.cjs');

module.exports = async function usageTrack(context, req) {
  context.log('[usage/track] request received');

  if (!req.body || typeof req.body !== 'object') {
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
    const entity = await recordUsageEvent(req, req.body);
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
