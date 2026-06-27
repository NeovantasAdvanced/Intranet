import {
  Bot,
  CalendarDays,
  FileText,
  Files,
  Home,
  LifeBuoy,
  Newspaper,
  Wrench,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { RELEASE_VERSION } from '../../config/releaseInfo';
import { AuthSessionProvider } from '../../context/AuthSessionContext';
import { PortalSearchProvider } from '../../context/PortalSearchContext';
import { useAuthSession } from '../../context/AuthSessionContext';
import { canAccessFeature } from '../../lib/accessControl';
import { trackUsageEvent } from '../../lib/usageTracking';
import { Header } from './Header';

type AppLayoutProps = {
  children: ReactNode;
};

const navigation = [
  { label: 'Inicio', icon: Home, href: '#inicio' },
  { label: 'Herramientas', icon: Bot, href: '#herramientas' },
  { label: 'Recursos de empleado', icon: Wrench, href: '#recursos-empleado' },
  { label: 'Documentacion', icon: FileText, href: '#documentacion' },
  { label: 'Repositorios', icon: Files, href: '#repositorios' },
  { label: 'Eventos', icon: CalendarDays, href: '#eventos' },
  { label: 'Noticias', icon: Newspaper, href: '#noticias' },
  { label: 'Soporte AST', icon: LifeBuoy, href: '#soporte-ast' },
];

function PortalNavigation() {
  const { clientPrincipal } = useAuthSession();
  const [activeHash, setActiveHash] = useState(() =>
    typeof window === 'undefined' ? '#inicio' : window.location.hash || '#inicio',
  );

  useEffect(() => {
    const handleHashChange = () => setActiveHash(window.location.hash || '#inicio');

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const userEmail = clientPrincipal?.userDetails ?? '';
  const visibleNavigation = navigation.filter((item) =>
    item.href === '#repositorios' ? canAccessFeature('repositories', userEmail) : true,
  );

  return (
    <nav
      className="border-b border-[#d8e3f1] bg-white/96 px-3 shadow-[0_1px_0_rgba(13,30,61,0.03)] backdrop-blur md:px-8"
      aria-label="Navegacion principal"
    >
      <div className="mx-auto flex max-w-[1200px] gap-1 overflow-x-auto py-2">
        {visibleNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = activeHash === item.href;

          return (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setActiveHash(item.href)}
              className={`focus-ring flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-semibold transition ${
                isActive
                  ? 'border border-neovantas-blue bg-neovantas-navy text-white shadow-sm ring-1 ring-neovantas-cyan/35'
                  : 'border border-transparent text-neovantas-ink/65 hover:border-neovantas-cyan/25 hover:bg-[#eef6ff] hover:text-neovantas-blue'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-neovantas-ink/65'}`} aria-hidden="true" />
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

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a[href]');
      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute('href') ?? '';
      if (!href || href.startsWith('javascript:')) {
        return;
      }

      const label =
        anchor.getAttribute('aria-label')?.trim() ||
        anchor.getAttribute('title')?.trim() ||
        anchor.textContent?.trim() ||
        href;

      const sectionLabel = href.startsWith('#') ? label : window.location.hash.replace(/^#/, '') || 'inicio';

      trackUsageEvent({
        kind: href.startsWith('#') ? 'section' : 'link',
        label,
        href,
        section: sectionLabel,
      });
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return (
    <AuthSessionProvider>
      <PortalSearchProvider searchValue={searchValue} setSearchValue={setSearchValue}>
        <div className="min-h-screen bg-[#f7f9fc] text-neovantas-ink">
          <div className="sticky top-0 z-30">
            <Header />
            <PortalNavigation />
          </div>

          <main className="min-w-0 bg-transparent px-4 py-7 md:px-8 md:py-10">
            <div className="mx-auto w-full max-w-[1200px]">{children}</div>
          </main>

          <footer className="px-4 pb-4 md:px-8">
            <div className="mx-auto flex w-full max-w-[1200px] justify-end">
              <span className="text-xs font-semibold tracking-[0.12em] text-neovantas-muted">
                Workspace {RELEASE_VERSION}
              </span>
            </div>
          </footer>
        </div>
      </PortalSearchProvider>
    </AuthSessionProvider>
  );
}
