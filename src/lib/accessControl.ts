import accessControlData from '../data/access-control.json';

type AccessControlData = {
  admins?: {
    allowedEmails?: string[];
  };
  repositories?: {
    allowedEmails?: string[];
    blockedEmails?: string[];
  };
};

type FeatureKey = 'admins' | 'repositories';

const accessControl = accessControlData as AccessControlData;

function normalizeEmail(value: string) {
  return String(value ?? '').trim().toLowerCase();
}

function getConfiguredEmails(key: FeatureKey) {
  const fromFile = accessControl[key]?.allowedEmails ?? [];
  const fromEnv =
    key === 'admins'
      ? (import.meta.env.VITE_ADMIN_EMAILS ?? '').split(',')
      : (import.meta.env.VITE_REPOSITORY_EMAILS ?? '').split(',');

  return [...fromFile, ...fromEnv].map((email) => normalizeEmail(email)).filter(Boolean);
}

export function isAdmin(userEmail: string) {
  return canAccessFeature('admins', userEmail);
}

export function canAccessFeature(featureKey: FeatureKey, userEmail: string) {
  const normalized = normalizeEmail(userEmail);
  if (!normalized) {
    return false;
  }

  return getConfiguredEmails(featureKey).includes(normalized);
}

export function canAccessStatistics(userEmail: string) {
  return isAdmin(userEmail);
}
