export const INTRANET_ADMIN_GROUP_NAME = 'Intranet Admins';

function normalizeEmail(value: string) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeRole(value: string) {
  return normalizeEmail(value);
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

export function isAdminRoleMember(userRoles: string[] = []) {
  return userRoles.some((role) => normalizeRole(role) === normalizeRole(INTRANET_ADMIN_GROUP_NAME));
}

export function getConfiguredAdminEmailsForDisplay() {
  return getConfiguredAdminEmails();
}
