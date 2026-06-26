import { BarChart3, Boxes, LayoutDashboard, RefreshCcw, ShieldCheck, Users2, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { APP_VERSION } from '../config/appVersion';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useAuthSession } from '../context/AuthSessionContext';
import { canAccessStatistics, isAdmin } from '../lib/accessControl';
import {
  getAccessControl,
  getManagedContent,
  getUsersAccess,
  updateAccessControl,
  updateManagedContent,
  updateUserAccess,
  type AccessControlData,
  type ManagedContentData,
  type UserAccessRow as StoredUserAccessRow,
} from '../lib/adminStorage';
import { AdminUsagePage } from './AdminUsagePage';
import usersAccessData from '../data/users-access.json';
import newsData from '../data/news.json';
import eventsData from '../data/events.json';
import sharePointCatalogData from '../data/sharepointCatalog.json';
import appsData from '../data/apps.json';
import documentsData from '../data/documents.json';
import { type EventItem, type InternalApp, type DocumentItem, type NewsItem, type SharePointCatalog } from '../types/content';

type AdminTabId = 'dashboard' | 'statistics' | 'users' | 'sync' | 'content';

type UserAccessRow = {
  name: string;
  email: string;
  department: string;
  jobTitle: string;
  permissions: {
    admin: boolean;
    repositories: boolean;
  };
};

type EditableContentRow = {
  id: string;
  section: 'tools' | 'employeeResources' | 'documents' | 'quickLinks';
  title: string;
  description: string;
  href: string;
  category: string;
  visible: boolean;
};

const tabs: { id: AdminTabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'statistics', label: 'Estadísticas', icon: BarChart3 },
  { id: 'users', label: 'Usuarios y permisos', icon: Users2 },
  { id: 'sync', label: 'Sincronizaciones', icon: RefreshCcw },
  { id: 'content', label: 'Contenido', icon: Boxes },
];

const users = usersAccessData as UserAccessRow[];
const news = newsData as NewsItem[];
const events = eventsData as EventItem[];
const sharePointCatalog = sharePointCatalogData as SharePointCatalog;
const apps = appsData as InternalApp[];
const documents = documentsData as DocumentItem[];

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
  const userEmail = clientPrincipal?.userDetails ?? '';
  const [activeTab, setActiveTab] = useState<AdminTabId>(getInitialTab);
  const [userSearch, setUserSearch] = useState('');
  const [permissionFilter, setPermissionFilter] = useState<'all' | 'admin' | 'repositories'>('all');
  const [accessControlData, setAccessControlData] = useState<AccessControlData | null>(null);
  const [usersState, setUsersState] = useState<UserAccessRow[]>(users);
  const [contentState, setContentState] = useState<ManagedContentData | null>(null);
  const [contentRowsState, setContentRowsState] = useState<EditableContentRow[]>([]);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [storageNotice, setStorageNotice] = useState('');
  const adminAllowed = isAdmin(userEmail);

  useEffect(() => {
    const syncTabFromUrl = () => setActiveTab(getInitialTab());
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.all([getAccessControl(), getUsersAccess(), getManagedContent()])
      .then(([accessControl, usersAccess, content]) => {
        if (!mounted) {
          return;
        }

        setAccessControlData(accessControl);
        setUsersState(usersAccess as UserAccessRow[]);
        setContentState(content);
        setContentRowsState([
          ...content.tools.map((item) => ({
            section: 'tools' as const,
            id: item.id,
            title: item.title,
            description: item.description,
            href: item.href,
            category: item.category ?? item.group ?? 'tools',
            visible: (item as { visible?: boolean }).visible !== false,
          })),
          ...content.employeeResources.map((item) => ({
            section: 'employeeResources' as const,
            id: item.id,
            title: item.title,
            description: item.description,
            href: item.href,
            category: item.category ?? item.group ?? 'employee',
            visible: (item as { visible?: boolean }).visible !== false,
          })),
          ...content.documents.map((item) => ({
            section: 'documents' as const,
            id: item.id,
            title: item.title,
            description: item.description,
            href: item.href,
            category: item.area ?? 'documents',
            visible: true,
          })),
          ...content.quickLinks.map((item) => ({
            section: 'quickLinks' as const,
            id: item.id,
            title: item.title,
            description: item.description,
            href: item.href,
            category: item.icon,
            visible: true,
          })),
        ]);
        setStorageNotice(import.meta.env.DEV ? 'Cambios en modo local/desarrollo. Para persistencia real configurar Azure Storage.' : '');
      })
      .catch(() => {
        if (!mounted) {
          return;
        }

        setAccessControlData(null);
        setUsersState(users);
        setContentState(null);
        setContentRowsState([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const lastNewsDate = news[0]?.rawMeta?.dateText ?? formatDate(news[0]?.date);
  const lastNewsCount = news.length;
  const lastEvent = events[0];
  const portalStatus = 'Operativo';
  const authorizedUsers = users.filter((item) => item.permissions.repositories).length;
  const adminUsers = users.filter((item) => item.permissions.admin).length;
  const uniqueUsers = new Set(users.map((item) => item.email)).size;
  const accessibleSections = {
    quickLinks: 6,
    tools: apps.filter((item) => item.category === 'tools').length,
    employeeApps: apps.filter((item) => item.category === 'employee').length,
    documents: documents.length,
    news: news.length,
    events: events.length,
  };
  const sharePointItems = sharePointCatalog.resources.length + sharePointCatalog.repositories.length;
  const versionLabel = formatAppVersion();
  const effectiveAccessControl = accessControlData ?? {
    admins: { allowedEmails: ['fmacias@neovantas.com'] },
    repositories: { allowedEmails: ['fmacias@neovantas.com'] },
  };
  const effectiveContent = contentState ?? {
    tools: apps.filter((item) => item.category === 'tools'),
    employeeResources: apps.filter((item) => item.category === 'employee'),
    documents,
    quickLinks: [
      {
        id: 'home',
        title: 'Inicio',
        description: 'Acceso rápido al panel principal.',
        href: '#inicio',
        icon: 'home',
        status: 'Activo',
        tone: 'info',
      },
    ],
  };
  const contentRows = contentRowsState.length
    ? contentRowsState
    : [
        ...effectiveContent.tools.map((item) => ({
          section: 'tools' as const,
          id: item.id,
          title: item.title,
          description: item.description,
          href: item.href,
          category: item.category ?? item.group ?? 'tools',
          visible: true,
        })),
        ...effectiveContent.employeeResources.map((item) => ({
          section: 'employeeResources' as const,
          id: item.id,
          title: item.title,
          description: item.description,
          href: item.href,
          category: item.category ?? item.group ?? 'employee',
          visible: true,
        })),
        ...effectiveContent.documents.map((item) => ({
          section: 'documents' as const,
          id: item.id,
          title: item.title,
          description: item.description,
          href: item.href,
          category: item.area ?? 'documents',
          visible: true,
        })),
        ...effectiveContent.quickLinks.map((item) => ({
          section: 'quickLinks' as const,
          id: item.id,
          title: item.title,
          description: item.description,
          href: item.href,
          category: item.icon,
          visible: true,
        })),
      ];

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();

    return usersState.filter((user) => {
      const matchesQuery =
        !query ||
        [user.name, user.email, user.department, user.jobTitle]
          .join(' ')
          .toLowerCase()
          .includes(query);

      const matchesPermission =
        permissionFilter === 'all'
          ? true
          : permissionFilter === 'admin'
          ? user.permissions.admin
          : user.permissions.repositories;

      return matchesQuery && matchesPermission;
    });
  }, [permissionFilter, userSearch, usersState]);

  const adminCanViewStatistics = canAccessStatistics(userEmail);
  const adminEmails = effectiveAccessControl.admins.allowedEmails;
  const repositoryEmails = effectiveAccessControl.repositories.allowedEmails;

  const saveUsers = async (nextUsers: UserAccessRow[]) => {
    setSavingState('saving');
    try {
      const nextAccessControl: AccessControlData = {
        admins: {
          allowedEmails: nextUsers.filter((item) => item.permissions.admin).map((item) => item.email),
        },
        repositories: {
          allowedEmails: nextUsers.filter((item) => item.permissions.repositories).map((item) => item.email),
        },
      };
      setUsersState(nextUsers);
      setAccessControlData(nextAccessControl);
      await Promise.all([updateUserAccess(nextUsers as StoredUserAccessRow[]), updateAccessControl(nextAccessControl)]);
      setSavingState('saved');
    } catch {
      setSavingState('error');
    }
  };

  const saveContent = async (nextContent: ManagedContentData) => {
    setSavingState('saving');
    try {
      setContentState(nextContent);
      await updateManagedContent(nextContent);
      setSavingState('saved');
    } catch {
      setSavingState('error');
    }
  };

  const updateContentRow = (rowId: string, field: keyof EditableContentRow, value: string | boolean) => {
    setContentRowsState((current) => current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  };

  const persistContent = () => {
    const toApp = (row: EditableContentRow, category: 'tools' | 'employee') => ({
      id: row.id,
      title: row.title,
      description: row.description,
      owner: 'Admin',
      href: row.href,
      status: '',
      tone: 'info' as const,
      icon: 'files',
      category,
    });

    const toDoc = (row: EditableContentRow) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      area: row.category,
      updatedAt: new Date().toISOString().slice(0, 10),
      href: row.href,
      status: row.visible ? 'Disponible' : 'Oculto',
      tone: 'info' as const,
    });

    const toLink = (row: EditableContentRow) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      href: row.href,
      icon: row.category || 'home',
      status: row.visible ? 'Activo' : 'Oculto',
      tone: 'info' as const,
    });

    void saveContent({
      tools: contentRows.filter((row) => row.section === 'tools' && row.visible).map((row) => toApp(row, 'tools')),
      employeeResources: contentRows
        .filter((row) => row.section === 'employeeResources' && row.visible)
        .map((row) => toApp(row, 'employee')),
      documents: contentRows.filter((row) => row.section === 'documents' && row.visible).map((row) => toDoc(row)),
      quickLinks: contentRows.filter((row) => row.section === 'quickLinks' && row.visible).map((row) => toLink(row)),
    });
  };

  if (!adminAllowed) {
    return (
      <div className="rounded-[24px] border border-neovantas-line bg-white p-8 text-neovantas-navy">
        No tienes permisos para acceder a esta sección.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Centro de Administración"
        description="Panel central para administración, métricas, permisos, sincronizaciones y contenido."
      />

      <div className="flex flex-wrap gap-2">
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
          <StatCard title="Usuarios con permisos" value={String(users.length)} note={`${adminUsers} administradores detectados`} />
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
          <div className="border-b border-neovantas-line bg-[#eef6ff] px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-semibold text-neovantas-navy">Usuarios y permisos</h3>
                <p className="mt-1 text-sm text-neovantas-muted">
                  Gestión inicial desde JSON local. En una fase posterior se conectará con Microsoft Graph y almacenamiento persistente.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <SectionPill>{`${users.length} usuarios`}</SectionPill>
                <SectionPill>{`${adminEmails.length} admins`}</SectionPill>
                <SectionPill>{`${repositoryEmails.length} repositorios`}</SectionPill>
              </div>
            </div>
          </div>
          {storageNotice ? (
            <div className="border-b border-neovantas-line bg-[#eef6ff] px-5 py-3 text-sm text-neovantas-navy">
              {storageNotice}
            </div>
          ) : null}

          <div className="border-b border-neovantas-line bg-white px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex items-center gap-2 rounded-full border border-neovantas-line bg-white px-4 py-2 text-sm text-neovantas-muted">
                <Search className="h-4 w-4 shrink-0 text-neovantas-blue" aria-hidden="true" />
                <span className="sr-only">Buscar usuario</span>
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Buscar por nombre, email o departamento"
                  className="w-full min-w-0 border-0 bg-transparent text-sm text-neovantas-navy outline-none placeholder:text-neovantas-muted"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'admin', label: 'Admin' },
                  { id: 'repositories', label: 'Repositorios' },
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
                  <th className="px-5 py-4">Departamento</th>
                  <th className="px-5 py-4">Cargo</th>
                  <th className="px-5 py-4">Admin</th>
                  <th className="px-5 py-4">Repositorios</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neovantas-line bg-white">
                {filteredUsers.map((user) => (
                  <tr key={user.email}>
                    <td className="px-5 py-4 text-sm font-semibold text-neovantas-navy">{user.name}</td>
                    <td className="px-5 py-4 text-sm text-neovantas-muted">{user.email}</td>
                    <td className="px-5 py-4 text-sm text-neovantas-muted">{user.department}</td>
                    <td className="px-5 py-4 text-sm text-neovantas-muted">{user.jobTitle}</td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          setUsersState((current) =>
                            current.map((row) =>
                              row.email === user.email
                                ? { ...row, permissions: { ...row.permissions, admin: !row.permissions.admin } }
                                : row,
                            ),
                          )
                        }
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          user.permissions.admin
                            ? 'bg-neovantas-navy text-white'
                            : 'border border-neovantas-line bg-white text-neovantas-muted'
                        }`}
                      >
                        {user.permissions.admin ? 'Admin' : 'Sin admin'}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          setUsersState((current) =>
                            current.map((row) =>
                              row.email === user.email
                                ? { ...row, permissions: { ...row.permissions, repositories: !row.permissions.repositories } }
                                : row,
                            ),
                          )
                        }
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          user.permissions.repositories
                            ? 'bg-neovantas-blue text-white'
                            : 'border border-neovantas-line bg-white text-neovantas-muted'
                        }`}
                      >
                        {user.permissions.repositories ? 'Repositorios' : 'Sin acceso'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-neovantas-line bg-[#f7f9fc] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-neovantas-muted">
                Cambios en modo local/desarrollo. Para persistencia real configurar Azure Storage.
              </p>
              <button
                type="button"
                onClick={() => void saveUsers(usersState)}
                className="rounded-full bg-neovantas-navy px-4 py-2 text-sm font-semibold text-white"
              >
                Guardar permisos
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {activeTab === 'sync' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: 'Noticias Outlook',
              note: `Última fecha detectada: ${lastNewsDate}`,
              detail: `${news.length} noticias en catálogo`,
            },
            {
              title: 'Eventos Outlook',
              note: lastEvent ? `Último evento: ${lastEvent.title}` : 'Sin eventos cargados',
              detail: `${events.length} eventos en catálogo`,
            },
            {
              title: 'SharePoint catalog',
              note: `${sharePointCatalog.repositories.length} repositorios y ${sharePointCatalog.resources.length} recursos`,
              detail: `${sharePointItems} elementos totales`,
            },
            {
              title: 'Deploy Azure',
              note: `Versión visible: ${formatAppVersion()}`,
              detail: 'Estado calculado desde los catálogos actuales. Ejecución manual prevista en fase 2.',
            },
          ].map((item) => (
            <Card key={item.title} className="border border-neovantas-line bg-white p-5 shadow-[0_8px_24px_rgba(11,27,54,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neovantas-navy">{item.title}</p>
                  <p className="mt-2 text-sm text-neovantas-muted">{item.note}</p>
                </div>
                <Badge tone="neutral">Lectura informativa</Badge>
              </div>
              <p className="mt-4 text-sm text-neovantas-blue">{item.detail}</p>
              <p className="mt-2 text-xs text-neovantas-muted">Lectura informativa</p>
            </Card>
          ))}
        </div>
      ) : null}

      {activeTab === 'content' ? (
        <div className="space-y-4">
          <Card className="border border-neovantas-line bg-[#eef6ff] p-4 text-sm text-neovantas-navy">
            Lectura actual desde cat�logo JSON. Edici�n desde consola prevista en fase 2.
          </Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {contentRows.map((item) => (
              <Card key={item.section + '-' + item.id} className="border border-neovantas-line bg-white p-4 shadow-[0_8px_24px_rgba(11,27,54,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <input
                      value={item.title}
                      onChange={(event) => updateContentRow(item.id, 'title', event.target.value)}
                      className="w-full border-0 bg-transparent text-base font-semibold text-neovantas-navy outline-none"
                    />
                    <input
                      value={item.description}
                      onChange={(event) => updateContentRow(item.id, 'description', event.target.value)}
                      className="mt-2 w-full border-0 bg-transparent text-sm text-neovantas-muted outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateContentRow(item.id, 'visible', !item.visible)}
                    className={item.visible ? 'rounded-full bg-neovantas-navy px-3 py-1 text-xs font-semibold text-white' : 'rounded-full border border-neovantas-line bg-white px-3 py-1 text-xs font-semibold text-neovantas-muted'}
                  >
                    {item.visible ? 'Visible' : 'Oculto'}
                  </button>
                </div>
                <input
                  value={item.href}
                  onChange={(event) => updateContentRow(item.id, 'href', event.target.value)}
                  className="mt-3 w-full rounded-lg border border-neovantas-line bg-white px-3 py-2 text-sm text-neovantas-navy"
                />
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-neovantas-muted">
                  <span>{item.section}</span>
                  <input
                    value={item.category}
                    onChange={(event) => updateContentRow(item.id, 'category', event.target.value)}
                    className="w-36 rounded-full border border-neovantas-line bg-white px-3 py-1 text-xs text-neovantas-navy"
                  />
                </div>
              </Card>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={persistContent}
              className="rounded-full bg-neovantas-navy px-4 py-2 text-sm font-semibold text-white"
            >
              Guardar contenido
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
