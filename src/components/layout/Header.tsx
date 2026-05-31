import { Bell, LogIn, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import neovantasLogo from '../../assets/NEOVANTAS_LOGOTIPO_LIGHT_BLUE.svg';
import { usePortalSearch } from '../../context/PortalSearchContext';
import { SearchBar } from '../ui/SearchBar';

type ClientPrincipal = {
  userDetails: string;
  identityProvider: string;
  userRoles: string[];
};

type AuthPayload = {
  clientPrincipal: ClientPrincipal | null;
};

function getInitials(value: string) {
  return value
    .split(/[.\s@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function getLinkProps(href: string) {
  return href.startsWith('#') ? {} : { target: '_blank', rel: 'noreferrer' as const };
}

export function Header() {
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
  const initials = getInitials(authLabel) || 'N';

  return (
    <header className="bg-neovantas-navy px-4 text-white md:px-8">
      <div className="mx-auto flex min-h-16 max-w-[1200px] items-center gap-4 py-3">
        <a href="#inicio" className="focus-ring flex shrink-0 items-center gap-3 rounded-lg">
          <span className="flex h-10 items-center">
            <img src={neovantasLogo} alt="Neovantas" className="h-7 w-auto max-w-[9rem] object-contain" />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
              Neovantas
            </span>
            <span className="block truncate text-base font-semibold leading-tight text-white">
              Portal corporativo
            </span>
          </span>
        </a>

        <SearchBar
          value={searchValue}
          onChange={setSearchValue}
          className="hidden max-w-xl flex-1 md:flex"
          placeholder="Buscar accesos, documentos, repositorios y noticias"
        />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="focus-ring hidden h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/10 text-white/75 transition hover:bg-white/15 hover:text-white lg:grid"
            aria-label="Notificaciones"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
          </button>
          <a
            href={authHref}
            {...getLinkProps(authHref)}
            className="focus-ring flex h-10 max-w-[12rem] items-center gap-2 rounded-full border border-white/10 bg-white/10 px-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-white/15 sm:max-w-60 sm:px-3"
            title={authTitle}
            aria-label={authTitle}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-neovantas-navy">
              {isAuthenticated ? initials : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
            </span>
            <span className="hidden truncate sm:block">{authChecked ? authLabel : 'Comprobando...'}</span>
            {isAuthenticated ? (
              <UserRound className="hidden h-4 w-4 shrink-0 text-white/60 xl:block" aria-hidden="true" />
            ) : null}
          </a>
          {isAuthenticated ? (
            <a
              href="/logout"
              {...getLinkProps('/logout')}
              className="focus-ring hidden h-10 w-10 place-items-center rounded-full bg-white text-neovantas-navy shadow-sm md:grid"
              aria-label="Cerrar sesion"
              title="Cerrar sesion"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <a
              href="/login"
              {...getLinkProps('/login')}
              className="focus-ring hidden h-10 w-10 place-items-center rounded-full bg-white text-neovantas-navy shadow-sm md:grid"
              aria-label="Iniciar sesion"
              title="Iniciar sesion"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] pb-3 md:hidden">
        <SearchBar
          value={searchValue}
          onChange={setSearchValue}
          placeholder="Buscar en la intranet"
        />
      </div>
    </header>
  );
}
