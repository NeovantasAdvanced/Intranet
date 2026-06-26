console.log('admin access function loaded');

const { getPrincipalFromRequest, isAdminPrincipal } = require('../../_shared/auth.cjs');
const { readAdminState, writeAdminState } = require('../../_shared/admin-store.cjs');

function parseBody(body) {
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

module.exports = async function (context, req) {
  console.log('admin access handler invoked');
  const principal = getPrincipalFromRequest(req);
  const hasStorageConnection = Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage);
  context.log(
    `[admin/access] ${req.method} request from ${principal?.userDetails || 'anonymous'} storage=${
      hasStorageConnection ? 'azure-table' : 'fallback'
    } tables=IntranetAccessControl,IntranetUsersAccess,IntranetManagedContent`,
  );

  try {
    if (!isAdminPrincipal(principal)) {
      context.log.warn('[admin/access] forbidden request rejected');
      context.res = {
        status: 403,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'Forbidden' }),
      };
      return;
    }

    if (req.method === 'GET') {
      const state = await readAdminState();
      context.log('[admin/access] GET ok');
      context.res = {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true, ...state }),
      };
      return;
    }

    const payload = parseBody(req.body);
    if (!payload) {
      context.log.warn('[admin/access] invalid JSON payload');
      context.res = {
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'Invalid JSON payload.' }),
      };
      return;
    }

    const current = await readAdminState();
    const nextState = {
      accessControl: payload.accessControl ?? current.accessControl,
      usersAccess: payload.usersAccess ?? current.usersAccess,
      content: payload.content ?? current.content,
    };

    const saved = await writeAdminState(nextState);
    context.log('[admin/access] write ok');
    context.res = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, ...saved }),
    };
  } catch (error) {
    context.log.error('[admin/access] failed', error);
    context.res = {
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Admin storage operation failed.',
      }),
    };
  }
};
