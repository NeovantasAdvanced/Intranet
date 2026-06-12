import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchClientPrincipal, getClientPrincipalDisplayName, type ClientPrincipal } from '../lib/auth';
import { setUsageTrackingPrincipal } from '../lib/usageTracking';

type AuthSessionContextValue = {
  authChecked: boolean;
  clientPrincipal: ClientPrincipal | null;
  displayName: string;
};

const AuthSessionContext = createContext<AuthSessionContextValue>({
  authChecked: false,
  clientPrincipal: null,
  displayName: '',
});

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [clientPrincipal, setClientPrincipal] = useState<ClientPrincipal | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    fetchClientPrincipal()
      .then((principal) => {
        if (mounted) {
          setClientPrincipal(principal);
          setUsageTrackingPrincipal(principal);
        }
      })
      .catch(() => {
        if (mounted) {
          setClientPrincipal(null);
          setUsageTrackingPrincipal(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setAuthChecked(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      authChecked,
      clientPrincipal,
      displayName: getClientPrincipalDisplayName(clientPrincipal),
    }),
    [authChecked, clientPrincipal],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  return useContext(AuthSessionContext);
}
