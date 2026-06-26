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

module.exports = async function adminAccess(context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!isAdminPrincipal(principal)) {
    context.res = {
      status: 403,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Forbidden' }),
    };
    return;
  }

  if (req.method === 'GET') {
    const state = await readAdminState();
    context.res = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, ...state }),
    };
    return;
  }

  const payload = parseBody(req.body);
  if (!payload) {
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
  context.res = {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true, ...saved }),
  };
};
