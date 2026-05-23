import { useState, type ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [searchValue, setSearchValue] = useState('');

  return (
    <div className="min-h-screen bg-neovantas-mist text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header searchValue={searchValue} onSearchChange={setSearchValue} />
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto w-full max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
