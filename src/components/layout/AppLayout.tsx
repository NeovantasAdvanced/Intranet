import {
  BriefcaseBusiness,
  FileText,
  Files,
  Home,
  LayoutGrid,
  Newspaper,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { APP_VERSION } from '../../config/appVersion';
import { PortalSearchProvider } from '../../context/PortalSearchContext';
import { Header } from './Header';

type AppLayoutProps = {
  children: ReactNode;
};

const navigation = [
  { label: 'Inicio', icon: Home, href: '#inicio' },
  { label: 'Accesos', icon: LayoutGrid, href: '#accesos' },
  { label: 'Repositorios', icon: Files, href: '#repositorios' },
  { label: 'Noticias', icon: Newspaper, href: '#noticias' },
  { label: 'Documentacion', icon: FileText, href: '#documentacion' },
  { label: 'Aplicaciones', icon: BriefcaseBusiness, href: '#aplicaciones' },
];

function PortalNavigation() {
  const [activeHash, setActiveHash] = useState(() =>
    typeof window === 'undefined' ? '#inicio' : window.location.hash || '#inicio',
  );

  useEffect(() => {
    const handleHashChange = () => setActiveHash(window.location.hash || '#inicio');

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <nav
      className="border-b border-neovantas-line bg-white/95 px-3 shadow-[0_1px_0_rgba(13,30,61,0.03)] backdrop-blur md:px-8"
      aria-label="Navegacion principal"
    >
      <div className="mx-auto flex max-w-[1200px] gap-1 overflow-x-auto py-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activeHash === item.href;

          return (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setActiveHash(item.href)}
              className={`focus-ring flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-semibold transition ${
                isActive
                  ? 'bg-neovantas-navy text-white shadow-sm'
                  : 'text-neovantas-muted hover:bg-neovantas-mist hover:text-neovantas-navy'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const [searchValue, setSearchValue] = useState('');

  return (
    <PortalSearchProvider searchValue={searchValue} setSearchValue={setSearchValue}>
      <div className="min-h-screen bg-neovantas-mist text-neovantas-ink">
        <div className="sticky top-0 z-30">
          <Header />
          <PortalNavigation />
        </div>

        <main className="min-w-0 px-4 py-7 md:px-8 md:py-10">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>

        <footer className="px-4 pb-4 md:px-8">
          <div className="mx-auto flex w-full max-w-[1200px] justify-end">
            <span className="rounded-full border border-neovantas-line bg-white px-3 py-1 text-sm font-semibold text-neovantas-navy shadow-sm">
              Version {APP_VERSION}
            </span>
          </div>
        </footer>
      </div>
    </PortalSearchProvider>
  );
}
