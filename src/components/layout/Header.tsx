import { Bell, Menu, ShieldCheck, UserRound } from 'lucide-react';
import { SearchBar } from '../ui/SearchBar';

type HeaderProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
};

export function Header({ searchValue, onSearchChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-neovantas-mist/95 px-4 py-4 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="focus-ring grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <SearchBar
          value={searchValue}
          onChange={onSearchChange}
          className="max-w-2xl flex-1"
          placeholder="Buscar accesos, documentos, asistentes y noticias"
        />

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            className="focus-ring grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm"
            aria-label="Notificaciones"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="focus-ring flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm"
          >
            <ShieldCheck className="h-4 w-4 text-neovantas-teal" aria-hidden="true" />
            Entra ID listo
          </button>
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
