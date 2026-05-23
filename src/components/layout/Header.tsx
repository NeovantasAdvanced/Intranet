import { Bell, Menu, ShieldCheck, UserRound } from 'lucide-react';
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
      });

    return () => {
      mounted = false;
    };
  }, []);

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

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            className="focus-ring grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm"
            aria-label="Notificaciones"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
          </button>
          <a
            href={clientPrincipal ? '/logout' : '/login'}
            className="focus-ring flex h-10 max-w-56 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm"
            title={clientPrincipal ? `Sesion: ${clientPrincipal.userDetails}` : 'Iniciar sesion con Microsoft 365'}
          >
            <ShieldCheck className="h-4 w-4 text-neovantas-teal" aria-hidden="true" />
            <span className="truncate">{clientPrincipal ? clientPrincipal.userDetails : 'Microsoft 365'}</span>
          </a>
          <button
            type="button"
            className="focus-ring grid h-10 w-10 place-items-center rounded-lg bg-neovantas-navy text-white shadow-sm"
            aria-label="Perfil"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
