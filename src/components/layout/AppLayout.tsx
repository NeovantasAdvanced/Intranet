import { useState, type ReactNode } from 'react';
import { PortalSearchProvider } from '../../context/PortalSearchContext';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [searchValue, setSearchValue] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <PortalSearchProvider searchValue={searchValue} setSearchValue={setSearchValue}>
      <div className="min-h-screen bg-neovantas-mist text-slate-950">
        <div className="flex min-h-screen">
          <Sidebar className="hidden lg:flex" />

          <div
            className={`fixed inset-0 z-40 lg:hidden ${
              mobileMenuOpen ? '' : 'pointer-events-none'
            }`}
            aria-hidden={!mobileMenuOpen}
          >
            <button
              type="button"
              className={`absolute inset-0 bg-slate-950/50 transition-opacity ${
                mobileMenuOpen ? 'opacity-100' : 'opacity-0'
              }`}
              aria-label="Cerrar menu"
              onClick={() => setMobileMenuOpen(false)}
            />
            <Sidebar
              className={`relative z-10 flex transition-transform duration-200 ${
                mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
              onClose={() => setMobileMenuOpen(false)}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <Header onMenuClick={() => setMobileMenuOpen(true)} />
            <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
              <div className="mx-auto w-full max-w-7xl">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </PortalSearchProvider>
  );
}
