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

function normalizeEmail(value: string) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeRole(value: string) {
  return normalizeEmail(value).replace(/\s+/g, ' ');
}

function getConfiguredAdminEmails() {
  const rawEmails = import.meta.env.VITE_ADMIN_EMAILS ?? '';

  return rawEmails
    .split(',')
    .map((email: string) => normalizeEmail(email))
    .filter(Boolean);
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

  return (principal.claims ?? []).some((claim) => {
    const claimType = normalizeRole(claim.typ ?? '');
    const claimValue = normalizeRole(claim.val ?? '');

    if (!claimType || !claimValue) {
      return false;
    }

    if (!['role', 'roles', 'wids', 'groups'].includes(claimType)) {
      return false;
    }

    return ADMIN_ROLE_ALIASES.has(claimValue);
  });
}

export function getConfiguredAdminEmailsForDisplay() {
  return getConfiguredAdminEmails();
}
