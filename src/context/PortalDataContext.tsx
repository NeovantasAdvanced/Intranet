import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Assistant, DocumentItem, EventItem, InternalApp, NewsItem, SharePointCatalog, SupportAstItem } from '../types/content';

export type PortalData = {
  profile: { isAdmin: boolean; canViewRepositories: boolean };
  assistants: Assistant[];
  news: NewsItem[];
  events: EventItem[];
  documents: DocumentItem[];
  sharePointCatalog: SharePointCatalog;
  apps: InternalApp[];
  supportAst: SupportAstItem[];
  quickLinks: unknown[];
};

const emptyData: PortalData = { profile: { isAdmin: false, canViewRepositories: false }, assistants: [], news: [], events: [], documents: [], sharePointCatalog: { repositories: [], resources: [] }, apps: [], supportAst: [], quickLinks: [] };
const PortalDataContext = createContext<{ data: PortalData; loading: boolean; error: boolean }>({ data: emptyData, loading: true, error: false });

export function PortalDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PortalData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/portal-data', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => { if (!response.ok) throw new Error('portal-data-failed'); return response.json() as Promise<{ ok: boolean } & PortalData>; })
      .then((payload) => { if (!payload.ok) throw new Error('portal-data-failed'); setData(payload); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({ data, loading, error }), [data, loading, error]);
  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>;
}

export function usePortalData() { return useContext(PortalDataContext); }
