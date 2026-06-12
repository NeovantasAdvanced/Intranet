const { buildUsageSummary, getTableClient, listUsageEntities } = require('../_shared/usage-store.cjs');
const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');

function getLookbackDays(req) {
  const raw = Number(req.query?.days ?? req.query?.lookbackDays ?? process.env.USAGE_LOOKBACK_DAYS ?? '365');
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 3650) : 365;
}

module.exports = async function usageSummary(context, req) {
  const principal = getPrincipalFromRequest(req);

  if (!isAdminPrincipal(principal)) {
    context.res = {
      status: 403,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: 'Forbidden',
      }),
    };
    return;
  }

  try {
    await getTableClient();
    const daysBack = getLookbackDays(req);
    const entities = await listUsageEntities(daysBack);
    const summary = buildUsageSummary(entities);

    context.res = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        range: { daysBack },
        ...summary,
      }),
    };
  } catch (error) {
    context.log.error('[usage/summary] failed', error);
    context.res = {
      status: 503,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Usage metrics are unavailable.',
        totals: { accessesTotal: 0, uniqueUsers: 0 },
        sections: [],
        topSections: [],
        links: [],
        topLinks: [],
        activityByDay: [],
        activityByUser: [],
      }),
    };
  }
};
