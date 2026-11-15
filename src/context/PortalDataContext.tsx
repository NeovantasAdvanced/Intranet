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
  const [accessStatus, setAccessStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/portal-data', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => { if (!response.ok) throw new Error('portal-data-failed'); return response.json() as Promise<{ ok: boolean } & PortalData>; })
      .then((payload) => { if (!payload.ok) throw new Error('portal-data-failed'); setData(payload); })
      .catch(async () => {
        setError(true);
        try {
          const response = await fetch('/api/access-request', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
          const payload = await response.json() as { requestStatus?: string };
          setAccessStatus(payload.requestStatus ?? 'unavailable');
        } catch {
          setAccessStatus('unavailable');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({ data, loading, error, accessStatus }), [data, loading, error, accessStatus]);
  if (accessStatus && accessStatus !== 'unavailable') {
    const message = accessStatus === 'pending'
      ? 'Tu solicitud está pendiente de revisión por Administración.'
      : accessStatus === 'not-in-corporate-roster'
        ? 'Tu identidad no figura en el censo corporativo autorizado.'
        : accessStatus === 'revoked' || accessStatus === 'suspended'
          ? 'Tu acceso está suspendido o revocado. Contacta con Administración.'
          : 'No se ha podido comprobar tu autorización en este momento.';
    return <PortalDataContext.Provider value={value}><main className="grid min-h-screen place-items-center bg-[#f7f9fc] px-4"><div className="max-w-lg rounded-[24px] border border-neovantas-line bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-semibold text-neovantas-navy">Acceso pendiente</h1><p className="mt-3 text-sm leading-6 text-neovantas-muted">{message}</p></div></main></PortalDataContext.Provider>;
  }
  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>;
}

export function usePortalData() { return useContext(PortalDataContext); }
