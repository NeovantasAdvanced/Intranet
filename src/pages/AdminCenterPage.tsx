import { ArrowLeft, BarChart3, Boxes, LayoutDashboard, RefreshCcw, Search, Users2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { APP_VERSION } from '../config/appVersion';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useAuthSession } from '../context/AuthSessionContext';
import { usePortalData } from '../context/PortalDataContext';
import { AdminUsagePage } from './AdminUsagePage';
import { type DocumentItem, type EventItem, type InternalApp, type NewsItem, type SharePointCatalog } from '../types/content';

type AdminTabId = 'dashboard' | 'statistics' | 'users' | 'sync' | 'content';

type OrganizationUserRow = {
  displayName: string;
  email: string;
  userPrincipalName: string;
  jobTitle: string;
  department: string;
};

type AccessControlDraft = {
  admins: {
    allowedEmails: string[];
  };
  repositories: {
    allowedEmails: string[];
    blockedEmails: string[];
  };
};

type CentralAccessUser = {
  rowKey: string;
  displayName?: string;
  email?: string;
  jobTitle?: string;
  status: 'pending' | 'active' | 'suspended' | 'revoked';
  permissions: { intranet?: boolean; neo?: boolean; repositories?: boolean; admin?: boolean };
};

const tabs: { id: AdminTabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'statistics', label: 'Estadísticas', icon: BarChart3 },
  { id: 'users', label: 'Usuarios y permisos', icon: Users2 },
  { id: 'sync', label: 'Sincronizaciones', icon: RefreshCcw },
  { id: 'content', label: 'Contenido', icon: Boxes },
];

function getInitialTab() {
  if (typeof window === 'undefined') {
    return 'dashboard';
  }

  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  return tabs.some((item) => item.id === tab) ? (tab as AdminTabId) : 'dashboard';
}

function formatDate(value?: string) {
  if (!value) {
    return 'Sin datos';
  }

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatAppVersion() {
  return APP_VERSION && APP_VERSION !== '0' ? APP_VERSION : '';
}

function StatCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <Card className="border border-neovantas-line bg-white p-5 shadow-[0_8px_24px_rgba(11,27,54,0.04)]">
      <p className="text-sm font-medium text-neovantas-muted">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-neovantas-navy">{value}</p>
      <p className="mt-3 text-sm text-neovantas-muted">{note}</p>
    </Card>
  );
}

function SectionPill({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neovantas-cyan/25 bg-[#eef6ff] px-2.5 py-1 text-xs font-semibold text-neovantas-blue">
      {children}
    </span>
  );
}

export function AdminCenterPage() {
  const { clientPrincipal } = useAuthSession();
  const { data: sharedPortalData } = usePortalData();
  const userEmail = clientPrincipal?.userDetails ?? '';
  const [activeTab, setActiveTab] = useState<AdminTabId>(getInitialTab);
  const [userSearch, setUserSearch] = useState('');
  const [permissionFilter, setPermissionFilter] = useState<'all' | 'repositories' | 'no-access' | 'admins'>('all');
  const [portalData, setPortalData] = useState<{
    organizationUsers: OrganizationUserRow[];
    accessControl: AccessControlDraft;
    news: NewsItem[];
    events: EventItem[];
    sharePointCatalog: SharePointCatalog;
    apps: InternalApp[];
    documents: DocumentItem[];
  } | null>(null);
  const [centralUsers, setCentralUsers] = useState<CentralAccessUser[]>([]);
  const [centralMessage, setCentralMessage] = useState('');
  const [centralSearch, setCentralSearch] = useState('');
  const [newUser, setNewUser] = useState({ displayName: '', email: '', jobTitle: '' });
  const adminAllowed = sharedPortalData.profile.isAdmin;

  useEffect(() => {
    const syncTabFromUrl = () => setActiveTab(getInitialTab());
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, []);

  const loadCentralUsers = () => fetch('/api/user-access-admin', { credentials: 'same-origin', cache: 'no-store' })
    .then(async (response) => { if (!response.ok) throw new Error('central-users-failed'); return response.json(); })
    .then((payload) => setCentralUsers(payload.users ?? []))
    .catch(() => setCentralMessage('No se pudo cargar el registro central.'));

  useEffect(() => { if (adminAllowed) loadCentralUsers(); }, [adminAllowed]);

  const updateCentralUser = async (user: CentralAccessUser, changes: Partial<Pick<CentralAccessUser, 'status' | 'permissions'>>) => {
    if (!window.confirm(`¿Confirmas el cambio para ${user.email || user.displayName || 'este usuario'}?`)) return;
    setCentralMessage('Guardando cambios...');
    try {
      const response = await fetch('/api/user-access-admin', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rowKey: user.rowKey, ...changes }) });
      if (!response.ok) throw new Error('central-users-update-failed');
      await loadCentralUsers();
      setCentralMessage('Cambios guardados.');
    } catch { setCentralMessage('No se pudieron guardar los cambios.'); }
  };

  const createCentralUser = async () => {
    if (!newUser.displayName || !newUser.email) return setCentralMessage('Nombre y correo son obligatorios.');
    if (!window.confirm(`¿Crear el usuario ${newUser.email}?`)) return;
    setCentralMessage('Creando usuario...');
    try {
      const response = await fetch('/api/user-access-admin', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create', ...newUser }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'create-failed');
      setNewUser({ displayName: '', email: '', jobTitle: '' });
      await loadCentralUsers();
      setCentralMessage('Usuario creado con permisos iniciales mínimos.');
    } catch (error) { setCentralMessage(error instanceof Error && error.message === 'user-already-exists' ? 'El usuario ya existe.' : 'No se pudo crear el usuario.'); }
  };

  const toggleCentralPermission = (user: CentralAccessUser, permission: 'intranet' | 'repositories' | 'neo' | 'admin') => updateCentralUser(user, { permissions: { ...user.permissions, [permission]: !user.permissions?.[permission] } });

  const filteredCentralUsers = centralUsers.filter((user) => `${user.displayName || ''} ${user.email || ''} ${user.jobTitle || ''} ${user.status}`.toLowerCase().includes(centralSearch.trim().toLowerCase()));

  useEffect(() => {
    fetch('/api/portal-data?scope=admin', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => { if (!response.ok) throw new Error('admin-data-failed'); return response.json(); })
      .then((payload) => setPortalData(payload))
      .catch(() => setPortalData(null));
  }, []);

  const organizationUsers = portalData?.organizationUsers ?? [];
  const accessControl = portalData?.accessControl ?? { admins: { allowedEmails: [] }, repositories: { allowedEmails: [], blockedEmails: [] } };
  const news = portalData?.news ?? [];
  const events = portalData?.events ?? [];
  const sharePointCatalog = portalData?.sharePointCatalog ?? { repositories: [], resources: [] };
  const apps = portalData?.apps ?? [];
  const documents = portalData?.documents ?? [];

  const lastNewsDate = news[0]?.rawMeta?.dateText ?? formatDate(news[0]?.date);
  const lastNewsCount = news.length;
  const lastEvent = events[0];
  const portalStatus = 'Operativo';
  const repositoryAllowedEmails = accessControl.repositories.allowedEmails ?? [];
  const adminAllowedEmails = accessControl.admins.allowedEmails ?? [];
  const repositoryInitialSet = useMemo(
    () => new Set(repositoryAllowedEmails.map((email) => email.trim().toLowerCase()).filter(Boolean)),
    [],
  );
  const [repositoryDraftEmails, setRepositoryDraftEmails] = useState<string[]>(repositoryAllowedEmails);
  const [repositoryChangeSource, setRepositoryChangeSource] = useState<Record<string, 'pilot' | 'manual'>>({});
  const authorizedUsers = repositoryAllowedEmails.length;
  const adminUsers = adminAllowedEmails.length;
  const sharePointItems = sharePointCatalog.resources.length + sharePointCatalog.repositories.length;
  const versionLabel = formatAppVersion();

  const organizationRows = useMemo(() => {
    const repositorySet = new Set(repositoryDraftEmails.map((email) => email.trim().toLowerCase()).filter(Boolean));
    const adminSet = new Set(adminAllowedEmails.map((email) => email.trim().toLowerCase()).filter(Boolean));
    const query = userSearch.trim().toLowerCase();

    return organizationUsers
      .map((user) => {
        const normalizedEmail = user.email.trim().toLowerCase();
        return {
          ...user,
          admin: adminSet.has(normalizedEmail),
          repositories: repositorySet.has(normalizedEmail),
        };
      })
      .filter((user) => {
        const matchesQuery =
          !query ||
          [user.displayName, user.email, user.department, user.jobTitle]
            .join(' ')
            .toLowerCase()
            .includes(query);

        const matchesFilter =
          permissionFilter === 'all'
            ? true
            : permissionFilter === 'admins'
              ? user.admin
              : permissionFilter === 'repositories'
                ? user.repositories
                : permissionFilter === 'no-access'
                  ? !user.repositories && !user.admin
                  : true;

        return matchesQuery && matchesFilter;
      });
  }, [adminAllowedEmails, permissionFilter, repositoryDraftEmails, userSearch]);

  const pendingAccessControlJson = useMemo(
    () =>
      JSON.stringify(
        {
          admins: {
            allowedEmails: adminAllowedEmails.slice().sort(),
          },
          repositories: {
            allowedEmails: repositoryDraftEmails.slice().sort(),
            blockedEmails: [],
          },
        },
        null,
        2,
      ),
    [adminAllowedEmails, repositoryDraftEmails],
  );

  const repositoryDraftSet = useMemo(
    () => new Set(repositoryDraftEmails.map((email) => email.trim().toLowerCase()).filter(Boolean)),
    [repositoryDraftEmails],
  );

  const repositoryOriginFor = (email: string) => {
    const normalized = email.trim().toLowerCase();
    const initial = repositoryInitialSet.has(normalized);
    const current = repositoryDraftSet.has(normalized);

    if (!current) {
      return initial ? 'Piloto' : 'Sin acceso';
    }

    return repositoryChangeSource[normalized] === 'manual' || !initial ? 'Manual' : 'Piloto';
  };

  const toggleRepositoryAccess = (email: string) => {
    const normalized = email.trim().toLowerCase();
    setRepositoryDraftEmails((current) =>
      current.some((item) => item.trim().toLowerCase() === normalized)
        ? current.filter((item) => item.trim().toLowerCase() !== normalized)
        : [...current, normalized],
    );
    setRepositoryChangeSource((current) => ({ ...current, [normalized]: 'manual' }));
  };

  const hasPendingChanges =
    JSON.stringify(repositoryDraftEmails.slice().sort()) !== JSON.stringify(repositoryAllowedEmails.slice().sort()) ||
    Object.keys(repositoryChangeSource).length > 0;

  const adminCanViewStatistics = sharedPortalData.profile.isAdmin;

  if (!adminAllowed) {
    return <div className="rounded-[24px] border border-neovantas-line bg-white p-8 text-neovantas-navy">No tienes permisos para acceder a esta sección.</div>;
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Centro de Administración"
        description="Panel central para administración, métricas, permisos, sincronizaciones y contenido."
      />

      <div className="flex flex-wrap gap-2">
        <a
          href="/"
          className="focus-ring inline-flex items-center gap-2 rounded-full border border-neovantas-cyan/25 bg-[#eef6ff] px-4 py-2 text-sm font-semibold text-neovantas-blue transition hover:border-neovantas-blue hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver
        </a>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`focus-ring inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'border-neovantas-blue bg-neovantas-navy text-white shadow-sm'
                  : 'border-neovantas-line bg-white text-neovantas-muted hover:border-neovantas-cyan/30 hover:text-neovantas-blue'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'dashboard' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard title="Estado del portal" value={portalStatus} note="Vista ejecutiva del portal en tiempo real." />
          <StatCard title="Noticias" value={String(lastNewsCount)} note={`Último briefing: ${lastNewsDate}`} />
          <StatCard
            title="Eventos"
            value={String(events.length)}
            note={lastEvent ? `Próximo/último evento: ${lastEvent.title}` : 'Sin eventos cargados.'}
          />
          <StatCard title="Usuarios con permisos" value={String(organizationUsers.length)} note={`${adminUsers} administradores detectados`} />
          <StatCard title="Repositorios" value={String(authorizedUsers)} note="Usuarios autorizados para Repositorios." />
          {versionLabel ? <StatCard title="Versión" value={versionLabel} note="Versión del portal desde package.json." /> : null}
        </div>
      ) : null}

      {activeTab === 'statistics' ? (
        adminCanViewStatistics ? (
          <AdminUsagePage />
        ) : (
          <Card className="p-8 text-center text-neovantas-navy">No tienes permisos para acceder a esta sección.</Card>
        )
      ) : null}

      {activeTab === 'users' ? (
        <Card className="overflow-hidden border border-neovantas-line bg-white p-0 shadow-[0_8px_24px_rgba(11,27,54,0.04)]">
          <div className="border-b border-neovantas-line bg-[#fffaf0] px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div><h3 className="text-base font-semibold text-neovantas-navy">Solicitudes y autorizaciones centrales</h3><p className="mt-1 text-sm text-neovantas-muted">Las aprobaciones se guardan en Table Storage. La activación efectiva de la intranet sigue pendiente de la migración.</p></div>
              {centralMessage ? <span className="text-sm font-semibold text-neovantas-blue" role="status">{centralMessage}</span> : null}
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <input value={centralSearch} onChange={(event) => setCentralSearch(event.target.value)} placeholder="Buscar usuario central" className="min-w-[240px] flex-1 rounded-full border border-neovantas-line px-4 py-2 text-sm text-neovantas-navy" />
                <input value={newUser.displayName} onChange={(event) => setNewUser({ ...newUser, displayName: event.target.value })} placeholder="Nombre nuevo usuario" className="rounded-full border border-neovantas-line px-4 py-2 text-sm" />
                <input value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} placeholder="correo@neovantas.com" type="email" className="rounded-full border border-neovantas-line px-4 py-2 text-sm" />
                <input value={newUser.jobTitle} onChange={(event) => setNewUser({ ...newUser, jobTitle: event.target.value })} placeholder="Puesto" className="rounded-full border border-neovantas-line px-4 py-2 text-sm" />
                <button type="button" onClick={createCentralUser} className="rounded-full bg-neovantas-blue px-4 py-2 text-sm font-semibold text-white">Añadir usuario</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neovantas-line text-left text-sm"><thead><tr className="text-xs uppercase tracking-[0.1em] text-neovantas-muted"><th className="px-3 py-2">Usuario</th><th className="px-3 py-2">Puesto</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Permisos</th><th className="px-3 py-2">Acciones</th></tr></thead><tbody className="divide-y divide-neovantas-line">{filteredCentralUsers.map((user) => <tr key={user.rowKey}><td className="px-3 py-3"><div className="font-semibold text-neovantas-navy">{user.displayName || 'Sin nombre'}</div><div className="text-xs text-neovantas-muted">{user.email || 'Sin correo'}</div></td><td className="px-3 py-3 text-neovantas-muted">{user.jobTitle || 'Sin puesto'}</td><td className="px-3 py-3">{user.status}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-1">{(['intranet', 'repositories', 'neo', 'admin'] as const).map((permission) => <button key={permission} type="button" onClick={() => toggleCentralPermission(user, permission)} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${user.permissions?.[permission] ? 'border-neovantas-blue bg-neovantas-navy text-white' : 'border-neovantas-line text-neovantas-muted'}`}>{permission}</button>)}</div></td><td className="px-3 py-3"><div className="flex flex-wrap gap-2">{user.status === 'pending' ? <button type="button" onClick={() => updateCentralUser(user, { status: 'active', permissions: { ...user.permissions, intranet: true } })} className="rounded-full bg-neovantas-blue px-3 py-1 text-xs font-semibold text-white">Aprobar</button> : null}{user.status === 'active' ? <button type="button" onClick={() => updateCentralUser(user, { status: 'suspended' })} className="rounded-full border border-amber-200 px-3 py-1 text-xs text-amber-700">Suspender</button> : null}{user.status === 'suspended' ? <button type="button" onClick={() => updateCentralUser(user, { status: 'active' })} className="rounded-full border border-emerald-200 px-3 py-1 text-xs text-emerald-700">Reactivar</button> : null}{user.status !== 'revoked' ? <button type="button" onClick={() => updateCentralUser(user, { status: 'revoked' })} className="rounded-full border border-neovantas-line px-3 py-1 text-xs text-neovantas-muted">Revocar</button> : null}</div></td></tr>)}</tbody></table>
                {filteredCentralUsers.length === 0 ? <p className="py-4 text-sm text-neovantas-muted">No hay usuarios que coincidan.</p> : null}
              </div>
            </div>
            <div className="hidden">
              {centralUsers.length === 0 ? <p className="text-sm text-neovantas-muted">No hay solicitudes registradas.</p> : centralUsers.map((user) => <div key={user.rowKey} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neovantas-line bg-white px-3 py-3"><div><p className="text-sm font-semibold text-neovantas-navy">{user.displayName || user.email || 'Usuario'}</p><p className="text-xs text-neovantas-muted">{user.email || 'Identidad vinculada'} · {user.status}</p></div><div className="flex flex-wrap gap-2">{user.status === 'pending' ? <button type="button" onClick={() => updateCentralUser(user, { status: 'active', permissions: { ...user.permissions, intranet: true, neo: false, admin: false } })} className="rounded-full bg-neovantas-blue px-3 py-1.5 text-xs font-semibold text-white">Aprobar</button> : null}{user.status === 'pending' ? <button type="button" onClick={() => updateCentralUser(user, { status: 'revoked' })} className="rounded-full border border-neovantas-line px-3 py-1.5 text-xs font-semibold text-neovantas-muted">Rechazar</button> : null}{user.status === 'active' ? <button type="button" onClick={() => updateCentralUser(user, { status: 'suspended' })} className="rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700">Suspender</button> : null}{user.status === 'suspended' ? <button type="button" onClick={() => updateCentralUser(user, { status: 'active' })} className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">Reactivar</button> : null}</div></div>) }
            </div>
          </div>
          <div className="border-b border-neovantas-line bg-[#eef6ff] px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-semibold text-neovantas-navy">Usuarios y permisos</h3>
                <p className="mt-1 text-sm text-neovantas-muted">
                  Carga inicial desde `organization-users.json`. Los cambios se guardan solo en el borrador local.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <SectionPill>{`${organizationUsers.length} usuarios`}</SectionPill>
                <SectionPill>{`${adminUsers} admins`}</SectionPill>
                <SectionPill>{`${authorizedUsers} repositorios`}</SectionPill>
              </div>
            </div>
          </div>

          <div className="border-b border-neovantas-line bg-white px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex items-center gap-2 rounded-full border border-neovantas-line bg-white px-4 py-2 text-sm text-neovantas-muted">
                <Search className="h-4 w-4 shrink-0 text-neovantas-blue" aria-hidden="true" />
                <span className="sr-only">Buscar usuario</span>
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Buscar por nombre, email, cargo o departamento"
                  className="w-full min-w-0 border-0 bg-transparent text-sm text-neovantas-navy outline-none placeholder:text-neovantas-muted"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'repositories', label: 'Con acceso a Repositorios' },
                  { id: 'no-access', label: 'Sin acceso' },
                  { id: 'admins', label: 'Admins' },
                ].map((filter) => {
                  const active = permissionFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setPermissionFilter(filter.id as typeof permissionFilter)}
                      className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                        active
                          ? 'border-neovantas-blue bg-neovantas-navy text-white'
                          : 'border-neovantas-line bg-white text-neovantas-muted hover:border-neovantas-cyan/30 hover:text-neovantas-blue'
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neovantas-line">
              <thead className="bg-white">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.12em] text-neovantas-muted">
                  <th className="px-5 py-4">Nombre</th>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">Cargo</th>
                  <th className="px-5 py-4">Departamento</th>
                  <th className="px-5 py-4">Repositorios</th>
                  <th className="px-5 py-4">Origen</th>
                  <th className="px-5 py-4">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neovantas-line bg-white">
                {organizationRows.map((user) => (
                  <tr key={user.email}>
                    <td className="px-5 py-4 text-sm font-semibold text-neovantas-navy">{user.displayName}</td>
                    <td className="px-5 py-4 text-sm text-neovantas-muted">{user.email}</td>
                    <td className="px-5 py-4 text-sm text-neovantas-muted">{user.jobTitle || 'Sin datos'}</td>
                    <td className="px-5 py-4 text-sm text-neovantas-muted">{user.department || 'Sin datos'}</td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => toggleRepositoryAccess(user.email)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                          repositoryDraftSet.has(user.email.trim().toLowerCase())
                            ? 'border-neovantas-blue bg-neovantas-navy text-white'
                            : 'border-neovantas-line bg-white text-neovantas-muted hover:border-neovantas-cyan/30 hover:text-neovantas-blue'
                        }`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            repositoryDraftSet.has(user.email.trim().toLowerCase()) ? 'bg-neovantas-cyan' : 'bg-neovantas-muted'
                          }`}
                        />
                        {repositoryDraftSet.has(user.email.trim().toLowerCase()) ? 'Con acceso' : 'Sin acceso'}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-semibold text-neovantas-blue">{repositoryOriginFor(user.email)}</span>
                    </td>
                    <td className="px-5 py-4">
                      {user.admin ? <Badge tone="info">Admin</Badge> : <span className="text-sm text-neovantas-muted">No</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-neovantas-line bg-[#f7f9fc] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <h3 className="text-base font-semibold text-neovantas-navy">Cambios pendientes</h3>
                <p className="mt-1 text-sm text-neovantas-muted">
                  Los cambios se preparan como JSON para actualizar access-control.json.
                  Origen inicial: Piloto. Los cambios posteriores se marcan como Manual.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SectionPill>{`${repositoryDraftSet.size} usuarios con acceso`}</SectionPill>
                  <SectionPill>{`${organizationUsers.length - repositoryDraftSet.size} usuarios sin acceso`}</SectionPill>
                  <SectionPill>{hasPendingChanges ? 'Cambios pendientes' : '0 cambios pendientes'}</SectionPill>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(pendingAccessControlJson);
                  }}
                  className="focus-ring inline-flex items-center justify-center rounded-full border border-neovantas-blue bg-neovantas-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neovantas-blue"
                >
                  Copiar JSON
                </button>
                <a
                  href={`data:application/json;charset=utf-8,${encodeURIComponent(pendingAccessControlJson)}`}
                  download="access-control.json"
                  className="focus-ring inline-flex items-center justify-center rounded-full border border-neovantas-line bg-white px-4 py-2 text-sm font-semibold text-neovantas-blue transition hover:border-neovantas-cyan/30 hover:bg-[#eef6ff]"
                >
                  Descargar access-control.json
                </a>
              </div>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-[#0A0A3F] p-4 text-xs leading-6 text-white">{pendingAccessControlJson}</pre>
          </div>
        </Card>
      ) : null}

      {activeTab === 'content' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            { title: 'Accesos rápidos', count: 6 },
            { title: 'Herramientas', count: apps.filter((item) => item.category === 'tools').length },
            { title: 'Recursos de empleado', count: apps.filter((item) => item.category === 'employee').length },
            { title: 'Documentos destacados', count: documents.length },
            { title: 'Noticias', count: news.length },
            { title: 'Eventos', count: events.length },
          ].map((item) => (
            <Card key={item.title} className="border border-neovantas-line bg-white p-5 shadow-[0_8px_24px_rgba(11,27,54,0.04)]">
              <p className="text-base font-semibold text-neovantas-navy">{item.title}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-neovantas-blue">{item.count}</p>
              <p className="mt-2 text-sm text-neovantas-muted">
                Lectura actual desde catálogo JSON. Edición desde consola prevista en fase 2.
              </p>
            </Card>
          ))}
        </div>
      ) : null}
    </section>
  );
}
