export type ClientPrincipal = {
  userDetails: string;
  identityProvider: string;
  userRoles: string[];
  claims?: Array<{
    typ?: string;
    val?: string;
  }>;
};

export type AuthPayload = {
  clientPrincipal: ClientPrincipal | null;
};

export async function fetchClientPrincipal() {
  try {
    const response = await fetch('/.auth/me', { cache: 'no-store' });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as AuthPayload;
    return payload.clientPrincipal ?? null;
  } catch {
    return null;
  }
}

export async function fetchCurrentUserEmail() {
  const principal = await fetchClientPrincipal();
  return principal?.userDetails?.trim() ?? '';
}

function getClaimValue(principal: ClientPrincipal | null, patterns: string[]) {
  const claims = principal?.claims ?? [];
  const match = claims.find((claim) => {
    const type = String(claim.typ ?? '').toLowerCase();
    return patterns.some((pattern) => type.includes(pattern));
  });

  return match?.val?.trim() ?? '';
}

export function getClientPrincipalDisplayName(principal: ClientPrincipal | null) {
  const claimName =
    getClaimValue(principal, ['name']) ||
    getClaimValue(principal, ['givenname']) ||
    getClaimValue(principal, ['preferred_username']);

  const fallback = principal?.userDetails?.trim() ?? '';
  const value = claimName || fallback;

  if (!value) {
    return '';
  }

  if (value.includes('@')) {
    const localPart = value.split('@')[0] ?? '';
    return localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  return value;
}
