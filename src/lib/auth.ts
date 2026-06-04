export type ClientPrincipal = {
  userDetails: string;
  identityProvider: string;
  userRoles: string[];
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
