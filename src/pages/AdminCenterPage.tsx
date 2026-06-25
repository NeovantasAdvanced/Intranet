import { BarChart3, Boxes, LayoutDashboard, RefreshCcw, ShieldCheck, Users2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useAuthSession } from '../context/AuthSessionContext';
import { canAccessFeature, isAdmin } from '../lib/accessControl';
import { AdminUsagePage } from './AdminUsagePage';
import usersAccessData from '../data/users-access.json';
import newsData from '../data/news.json';
import eventsData from '../data/events.json';
import { APP_VERSION } from '../config/appVersion';
import type { NewsItem, EventItem } from '../types/content';

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

function getInitialTab() {
  if (typeof window === 'undefined') {
    return 'dashboard';
  }

  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  return tabs.some((item) => item.id === tab) ? (tab as AdminTabId) : 'dashboard';
}

function StatCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-neovantas-muted">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-neovantas-navy">{value}</p>
      <p className="mt-3 text-sm text-neovantas-muted">{note}</p>
    </Card>
  );
}

export function AdminCenterPage() {
  const { clientPrincipal } = useAuthSession();
  const userEmail = clientPrincipal?.userDetails ?? '';
  const [activeTab, setActiveTab] = useState<AdminTabId>(getInitialTab);

  useEffect(() => {
    const syncTabFromUrl = () => setActiveTab(getInitialTab());
    window.addEventListener('popstate', syncTabFromUrl);
    window.addEventListener('searchchange', syncTabFromUrl as EventListener);
    return () => {
      window.removeEventListener('popstate', syncTabFromUrl);
      window.removeEventListener('searchchange', syncTabFromUrl as EventListener);
    };
  }, []);

  if (!isAdmin(userEmail)) {
    return <div className="rounded-[24px] border border-neovantas-line bg-white p-8 text-neovantas-navy">No tienes permisos para acceder a esta sección.</div>;
  }

  const uniqueUsers = new Set(users.map((user) => user.email)).size;
  const repositoryAccessUsers = users.filter((user) => user.permissions.repositories).length;
  const adminUsers = users.filter((user) => user.permissions.admin).length;
  const latestNewsDate = news[0]?.date ?? 'Sin datos';
  const latestEventsDate = events[0]?.startDate ?? 'Sin datos';

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
              className={`focus-ring inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                isActive
                  ? 'border-neovantas-blue bg-neovantas-navy text-white'
                  : 'border-neovantas-line bg-white text-neovantas-muted'
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
          <StatCard title="Usuarios activos" value={String(uniqueUsers)} note="Usuarios únicos con acceso registrado." />
          <StatCard title="Accesos totales" value="—" note="Se completará con la telemetría consolidada." />
          <StatCard title="Noticias" value={String(news.length)} note={`Último briefing: ${latestNewsDate}`} />
          <StatCard title="Eventos" value={String(events.length)} note={`Último evento: ${latestEventsDate}`} />
          <StatCard title="SharePoint" value="—" note="Pendiente de consolidar catálogo y uso." />
          <StatCard title="Última versión" value={APP_VERSION} note="Versión desplegada del portal." />
        </div>
      ) : null}

      {activeTab === 'statistics' ? <AdminUsagePage /> : null}

      {activeTab === 'users' ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-neovantas-line bg-neovantas-mist px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-neovantas-navy">Usuarios y permisos</h3>
                <p className="text-sm text-neovantas-muted">Lectura inicial desde JSON local. Sin persistencia todavía.</p>
              </div>
              <Badge tone="neutral">{`${users.length} usuarios`}</Badge>
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
                {users.map((user) => (
                  <tr key={user.email}>
                    <td className="px-5 py-4 text-sm font-semibold text-neovantas-navy">{user.name}</td>
                    <td className="px-5 py-4 text-sm text-neovantas-muted">{user.email}</td>
                    <td className="px-5 py-4 text-sm text-neovantas-muted">{user.department}</td>
                    <td className="px-5 py-4 text-sm text-neovantas-muted">{user.jobTitle}</td>
                    <td className="px-5 py-4 text-sm text-neovantas-muted">{user.permissions.admin ? 'Sí' : 'No'}</td>
                    <td className="px-5 py-4 text-sm text-neovantas-muted">{user.permissions.repositories ? 'Sí' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {activeTab === 'sync' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {['Noticias Outlook', 'Eventos Outlook', 'SharePoint catalog', 'Deploy Azure'].map((title) => (
            <Card key={title} className="p-5">
              <p className="text-sm font-semibold text-neovantas-navy">{title}</p>
              <p className="mt-2 text-sm text-neovantas-muted">Última ejecución: pendiente de integración</p>
              <p className="mt-1 text-sm text-neovantas-muted">Estado: manual / mock</p>
              <button className="mt-4 inline-flex rounded-full border border-neovantas-line px-3 py-2 text-sm font-semibold text-neovantas-muted">
                Ejecutar ahora
              </button>
            </Card>
          ))}
        </div>
      ) : null}

      {activeTab === 'content' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            'Accesos rápidos',
            'Herramientas',
            'Recursos de empleado',
            'Documentos destacados',
            'Noticias destacadas',
            'Eventos',
          ].map((title) => (
            <Card key={title} className="p-5">
              <p className="text-base font-semibold text-neovantas-navy">{title}</p>
              <p className="mt-2 text-sm text-neovantas-muted">Próximamente editable desde la consola.</p>
            </Card>
          ))}
        </div>
      ) : null}
    </section>
  );
}
