import { Bell, LogIn, LogOut, Menu, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePortalSearch } from '../../context/PortalSearchContext';
import { SearchBar } from '../ui/SearchBar';

type HeaderProps = {
  onMenuClick: () => void;
};

type ClientPrincipal = {
  userDetails: string;
  identityProvider: string;
  userRoles: string[];
};

type AuthPayload = {
  clientPrincipal: ClientPrincipal | null;
};

export function Header({ onMenuClick }: HeaderProps) {
  const { searchValue, setSearchValue } = usePortalSearch();
  const [clientPrincipal, setClientPrincipal] = useState<ClientPrincipal | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    fetch('/.auth/me', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() as Promise<AuthPayload> : null))
      .then((payload) => {
        if (mounted && payload?.clientPrincipal) {
          setClientPrincipal(payload.clientPrincipal);
        }
      })
      .catch(() => {
        if (mounted) {
          setClientPrincipal(null);
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

  const isAuthenticated = Boolean(clientPrincipal);
  const authHref = isAuthenticated ? '/logout' : '/login';
  const authLabel = isAuthenticated ? clientPrincipal?.userDetails ?? 'Sesion iniciada' : 'Microsoft 365';
  const authTitle = isAuthenticated ? `Cerrar sesion: ${authLabel}` : 'Iniciar sesion con Microsoft 365';

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-neovantas-mist/95 px-4 py-4 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="focus-ring grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
          aria-label="Abrir menu"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <SearchBar
          value={searchValue}
          onChange={setSearchValue}
          className="max-w-2xl flex-1"
          placeholder="Buscar accesos, documentos, repositorios y noticias"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="focus-ring hidden h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm md:grid"
            aria-label="Notificaciones"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
          </button>
          <a
            href={authHref}
            className="focus-ring flex h-10 max-w-[11rem] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm sm:max-w-56"
            title={authTitle}
            aria-label={authTitle}
          >
            {isAuthenticated ? (
              <UserRound className="h-4 w-4 shrink-0 text-neovantas-teal" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-4 w-4 shrink-0 text-neovantas-teal" aria-hidden="true" />
            )}
            <span className="hidden truncate sm:block">{authChecked ? authLabel : 'Comprobando...'}</span>
          </a>
          {isAuthenticated ? (
            <a
              href="/logout"
              className="focus-ring hidden h-10 w-10 place-items-center rounded-lg bg-neovantas-navy text-white shadow-sm md:grid"
              aria-label="Cerrar sesion"
              title="Cerrar sesion"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <a
              href="/login"
              className="focus-ring hidden h-10 w-10 place-items-center rounded-lg bg-neovantas-navy text-white shadow-sm md:grid"
              aria-label="Iniciar sesion"
              title="Iniciar sesion"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
