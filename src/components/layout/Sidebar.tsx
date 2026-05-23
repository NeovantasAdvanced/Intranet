import {
  Bot,
  BriefcaseBusiness,
  FileText,
  Files,
  Home,
  LayoutDashboard,
  Lightbulb,
  Newspaper,
  Sparkles,
  X,
} from 'lucide-react';
import neovantasLogo from '../../assets/neovantas-logo-mark.svg';

const navigation = [
  { label: 'Inicio', icon: Home, active: true },
  { label: 'Asistentes GPT', icon: Bot },
  { label: 'Mesa IA', icon: Sparkles },
  { label: 'Documentacion', icon: FileText },
  { label: 'Repositorios', icon: Files },
  { label: 'Aplicaciones', icon: BriefcaseBusiness },
  { label: 'Noticias', icon: Newspaper },
  { label: 'Roadmap', icon: Lightbulb },
];

type SidebarProps = {
  className?: string;
  onClose?: () => void;
  onNavigate?: () => void;
};

export function Sidebar({ className = '', onClose, onNavigate }: SidebarProps) {
  return (
    <aside className={`min-h-screen w-72 shrink-0 flex-col bg-neovantas-navy px-5 py-6 text-white ${className}`}>
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white">
            <img src={neovantasLogo} alt="Neovantas" className="h-7 w-7 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-200">Neovantas</p>
            <h1 className="truncate text-lg font-semibold leading-tight">Portal Empleado</h1>
          </div>
        </div>

        {onClose ? (
          <button
            type="button"
            className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-200 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar menu"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav className="mt-9 flex flex-1 flex-col gap-1" aria-label="Navegacion principal">
        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              type="button"
              onClick={onNavigate}
              className={`focus-ring flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition ${
                item.active
                  ? 'bg-white text-neovantas-navy shadow-sm'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="rounded-lg border border-white/10 bg-white/10 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <LayoutDashboard className="h-4 w-4 text-lime-300" aria-hidden="true" />
          MVP intranet
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-300">
          Datos configurables desde JSON y despliegue preparado para Azure Static Web Apps.
        </p>
      </div>
    </aside>
  );
}
