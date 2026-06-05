const ADMIN_ROLE_ALIASES = new Set(
  [
    'admin',
    'administrator',
    'global administrator',
    'company administrator',
    'microsoft 365 administrator',
    'office 365 administrator',
    'tenant administrator',
    'privileged role administrator',
    'exchange administrator',
    'sharepoint administrator',
    'teams administrator',
    'security administrator',
    'intranet admins',
  ].map((value) => value.toLowerCase()),
);

const ADMIN_ROLE_IDS = new Set([
  '62e90394-69f5-4237-9190-012177145e10',
  'e8611ab8-c189-46e8-94e1-60213ab1f814',
]);

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeRole(value) {
  return normalizeEmail(value).replace(/\s+/g, ' ');
}

function parseConfiguredEmails() {
  const rawEmails = process.env.VITE_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '';

  return rawEmails
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function getClaimValue(principal, predicate) {
  return (principal?.claims ?? []).find((claim) => predicate(normalizeRole(claim.typ ?? '')))?.val ?? '';
}

function getPrincipalEmailCandidates(principal) {
  if (!principal) {
    return [];
  }

  const candidates = new Set();
  const pushCandidate = (value) => {
    const normalized = normalizeEmail(value);
    if (normalized.includes('@')) {
      candidates.add(normalized);
    }
  };

  pushCandidate(principal.userDetails);
  pushCandidate(getClaimValue(principal, (type) => type.includes('email')));
  pushCandidate(getClaimValue(principal, (type) => type.includes('preferred_username')));
  pushCandidate(getClaimValue(principal, (type) => type.includes('upn')));
  pushCandidate(getClaimValue(principal, (type) => type.includes('unique_name')));

  for (const claim of principal.claims ?? []) {
    const value = normalizeEmail(claim.val ?? '');
    if (value.includes('@')) {
      candidates.add(value);
    }
  }

  return [...candidates];
}

function isRoleLikeClaimType(value) {
  const normalized = normalizeRole(value);
  return (
    normalized.includes('role') ||
    normalized.includes('group') ||
    normalized.includes('wids') ||
    normalized.includes('directoryrole')
  );
}

function getPrincipalFromRequest(req) {
  const encoded = req?.headers?.['x-ms-client-principal'] || req?.headers?.['X-MS-CLIENT-PRINCIPAL'];
  if (!encoded) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    return payload ?? null;
  } catch {
    return null;
  }
}

function isAdminPrincipal(principal) {
  if (!principal) {
    return false;
  }

  const configuredEmails = parseConfiguredEmails();
  if (configuredEmails.length > 0) {
    const principalEmails = getPrincipalEmailCandidates(principal);
    if (principalEmails.some((email) => configuredEmails.includes(email))) {
      return true;
    }
  }

  const roleMatches = (principal.userRoles ?? []).some((role) => ADMIN_ROLE_ALIASES.has(normalizeRole(role)));
  if (roleMatches) {
    return true;
  }

  return (principal.claims ?? []).some((claim) => {
    const claimType = normalizeRole(claim.typ ?? '');
    const claimValue = normalizeRole(claim.val ?? '');

    if (!claimType || !claimValue || !isRoleLikeClaimType(claimType)) {
      return false;
    }

    return ADMIN_ROLE_ALIASES.has(claimValue) || ADMIN_ROLE_IDS.has(claimValue);
  });
}

module.exports = {
  getPrincipalFromRequest,
  getPrincipalEmailCandidates,
  isAdminPrincipal,
  normalizeEmail,
};
