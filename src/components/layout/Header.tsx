import { Bell, LogIn, LogOut, Settings2, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import neovantasLogo from '../../assets/NEOVANTAS_LOGOTIPO_LIGHT_BLUE.svg';
import { useAuthSession } from '../../context/AuthSessionContext';
import { isAdminUser, isOffice365AdminPrincipal } from '../../lib/admin';

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
  const { authChecked, clientPrincipal } = useAuthSession();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(Boolean(clientPrincipal && (isAdminUser(clientPrincipal.userDetails) || isOffice365AdminPrincipal(clientPrincipal))));
  }, [clientPrincipal]);

  const isAuthenticated = Boolean(clientPrincipal);
  const authHref = isAuthenticated ? '/logout' : '/login';
  const authLabel = isAuthenticated ? clientPrincipal?.userDetails ?? 'Sesion iniciada' : 'Microsoft 365';
  const authTitle = isAuthenticated ? `Cerrar sesion: ${authLabel}` : 'Iniciar sesion con Microsoft 365';
  const initials = getInitials(authLabel) || 'N';

  return (
    <header className="border-b border-white/10 bg-neovantas-navy px-4 text-white shadow-[0_12px_32px_rgba(11,27,54,0.18)] md:px-8">
      <div className="mx-auto flex min-h-[4.75rem] max-w-[1200px] items-center gap-4 py-3">
        <a href="#inicio" className="focus-ring flex shrink-0 items-center gap-3 rounded-lg">
          <span className="flex h-12 items-center">
            <img src={neovantasLogo} alt="Neovantas" className="h-9 w-auto max-w-[10.5rem] object-contain" />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-white/58">
              Workspace interno
            </span>
            <span className="block truncate text-[1rem] font-semibold leading-tight text-white">
              Portal corporativo
            </span>
          </span>
        </a>

        <div className="ml-auto flex items-center gap-2">
          {isAdmin ? (
            <a
              href="/admin/usage"
              className="focus-ring grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/10 text-white/75 transition hover:bg-white/18 hover:text-white"
              aria-label="Uso de la intranet"
              title="Uso de la intranet"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : null}
          <button
            type="button"
            className="focus-ring hidden h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/10 text-white/75 transition hover:bg-white/18 hover:text-white lg:grid"
            aria-label="Notificaciones"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
          </button>
          <a
            href={authHref}
            {...getLinkProps(authHref)}
            className="focus-ring flex h-10 max-w-[12rem] items-center gap-2 rounded-full border border-white/10 bg-white/10 px-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-white/18 sm:max-w-60 sm:px-3"
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

    </header>
  );
}
