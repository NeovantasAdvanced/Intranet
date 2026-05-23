import { createContext, useContext, type ReactNode } from 'react';

type PortalSearchContextValue = {
  searchValue: string;
  setSearchValue: (value: string) => void;
};

const PortalSearchContext = createContext<PortalSearchContextValue | undefined>(undefined);

type PortalSearchProviderProps = PortalSearchContextValue & {
  children: ReactNode;
};

export function PortalSearchProvider({
  children,
  searchValue,
  setSearchValue,
}: PortalSearchProviderProps) {
  return (
    <PortalSearchContext.Provider value={{ searchValue, setSearchValue }}>
      {children}
    </PortalSearchContext.Provider>
  );
}

export function usePortalSearch() {
  const context = useContext(PortalSearchContext);

  if (!context) {
    throw new Error('usePortalSearch must be used within PortalSearchProvider');
  }

  return context;
}
