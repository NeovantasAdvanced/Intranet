import type { ClientPrincipal } from './auth';

export const INTRANET_ADMIN_GROUP_NAME = 'Intranet Admins';

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
    INTRANET_ADMIN_GROUP_NAME,
  ].map((value) => value.toLowerCase()),
);

const ADMIN_ROLE_IDS = new Set([
  '62e90394-69f5-4237-9190-012177145e10', // Global Administrator
  'e8611ab8-c189-46e8-94e1-60213ab1f814', // Privileged Role Administrator
]);

function normalizeEmail(value: string) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeRole(value: string) {
  return normalizeEmail(value).replace(/\s+/g, ' ');
}

function isRoleLikeClaimType(value: string) {
  const normalized = normalizeRole(value);
  return (
    normalized.includes('role') ||
    normalized.includes('group') ||
    normalized.includes('wids') ||
    normalized.includes('directoryrole')
  );
}

function getConfiguredAdminEmails() {
  const rawEmails = import.meta.env.VITE_ADMIN_EMAILS ?? '';

  return rawEmails
    .split(',')
    .map((email: string) => normalizeEmail(email))
    .filter(Boolean);
}

function getClaimValue(principal: ClientPrincipal, predicate: (value: string) => boolean) {
  return (principal.claims ?? []).find((claim) => predicate(normalizeRole(claim.typ ?? '')))?.val ?? '';
}

export function getPrincipalEmailCandidates(principal: ClientPrincipal | null | undefined) {
  if (!principal) {
    return [];
  }

  const candidates = new Set<string>();
  const pushCandidate = (value: string) => {
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

export function isAdminUser(userEmail: string) {
  const normalizedEmail = normalizeEmail(userEmail);

  if (!normalizedEmail) {
    return false;
  }

  return getConfiguredAdminEmails().includes(normalizedEmail);
}

export function isOffice365AdminPrincipal(principal: ClientPrincipal | null | undefined) {
  if (!principal) {
    return false;
  }

  const roleMatches = (principal.userRoles ?? []).some((role) => ADMIN_ROLE_ALIASES.has(normalizeRole(role)));
  if (roleMatches) {
    return true;
  }

  const configuredAdminEmails = getConfiguredAdminEmails();
  if (configuredAdminEmails.length > 0) {
    const principalEmails = getPrincipalEmailCandidates(principal);
    if (principalEmails.some((email) => configuredAdminEmails.includes(email))) {
      return true;
    }
  }

  return (principal.claims ?? []).some((claim) => {
    const claimType = normalizeRole(claim.typ ?? '');
    const claimValue = normalizeRole(claim.val ?? '');

    if (!claimType || !claimValue) {
      return false;
    }

    if (!isRoleLikeClaimType(claimType)) {
      return false;
    }

    return ADMIN_ROLE_ALIASES.has(claimValue) || ADMIN_ROLE_IDS.has(claimValue);
  });
}

export function getConfiguredAdminEmailsForDisplay() {
  return getConfiguredAdminEmails();
}
