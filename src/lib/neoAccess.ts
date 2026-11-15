import type { ClientPrincipal } from './auth';
import { isAdmin as isConfiguredAdmin } from './accessControl';
import { isAdminUser, isOffice365AdminPrincipal } from './admin';

export function canAccessNeo(principal: ClientPrincipal | null | undefined) {
  return Boolean(
    principal &&
      (isConfiguredAdmin(principal.userDetails) ||
        isAdminUser(principal.userDetails) ||
        isOffice365AdminPrincipal(principal)),
  );
}
