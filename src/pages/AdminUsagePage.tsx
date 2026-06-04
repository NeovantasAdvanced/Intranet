import {
  Activity,
  BarChart3,
  CalendarDays,
  ChartColumn,
  CircleSlash2,
  MousePointerClick,
  ShieldAlert,
  UserRound,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { fetchClientPrincipal } from '../lib/auth';
import { isAdminRoleMember, isAdminUser } from '../lib/admin';

type UsageMetricRow = {
  label: string;
  count: number;
  href?: string;
};

type UsageSummary = {
  totals?: {
    accessesTotal?: number;
    uniqueUsers?: number;
  };
  topSections?: UsageMetricRow[];
  sections?: UsageMetricRow[];
  topLinks?: UsageMetricRow[];
  links?: UsageMetricRow[];
  activityByDay?: UsageMetricRow[];
  activityByUser?: UsageMetricRow[];
};

type AuthState = 'loading' | 'admin' | 'forbidden';

const DEFAULT_SUMMARY: UsageSummary = {
  totals: {
    accessesTotal: 0,
    uniqueUsers: 0,
  },
  topSections: [],
  topLinks: [],
  activityByDay: [],
  activityByUser: [],
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-ES').format(value);
}

function formatDateLabel(value: string) {
  if (!value) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function normalizeRows(rows?: UsageMetricRow[]) {
  return [...(rows ?? [])].sort((left, right) => right.count - left.count);
}

function MetricCard({
  title,
  value,
  icon: Icon,
  note,
}: {
  title: string;
  value: string;
  icon: typeof Activity;
  note: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neovantas-muted">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-neovantas-navy">{value}</p>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[#EEF8FF] text-neovantas-blue">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 text-sm text-neovantas-muted">{note}</p>
    </Card>
  );
}

function RankedList({
  title,
  icon: Icon,
  rows,
  emptyLabel,
}: {
  title: string;
  icon: typeof ChartColumn;
  rows: UsageMetricRow[];
  emptyLabel: string;
}) {
  const maxCount = rows[0]?.count ?? 0;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#EEF8FF] text-neovantas-blue">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-neovantas-navy">{title}</h3>
        </div>
        <Badge tone="neutral">{String(rows.length)}</Badge>
      </div>

      {rows.length > 0 ? (
        <div className="mt-5 space-y-3">
          {rows.map((row) => {
            const width = maxCount > 0 ? Math.max(8, Math.round((row.count / maxCount) * 100)) : 8;

            return (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-neovantas-navy">{row.label}</span>
                  <span className="text-sm font-semibold text-neovantas-muted">{formatNumber(row.count)}</span>
                </div>
                <div className="h-2 rounded-full bg-neovantas-mist">
                  <div className="h-2 rounded-full bg-neovantas-blue" style={{ width: `${width}%` }} />
                </div>
                {row.href ? (
                  <p className="truncate text-xs text-neovantas-muted">{row.href}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-[12px] border border-dashed border-neovantas-line bg-neovantas-mist px-4 py-6 text-sm text-neovantas-muted">
          {emptyLabel}
        </div>
      )}
    </Card>
  );
}

function ActivityList({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: UsageMetricRow[];
  emptyLabel: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#EAFBF2] text-neovantas-teal">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-neovantas-navy">{title}</h3>
      </div>

      {rows.length > 0 ? (
        <div className="mt-5 space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 rounded-[12px] bg-neovantas-mist px-4 py-3">
              <span className="truncate text-sm font-medium text-neovantas-navy">{row.label}</span>
              <span className="text-sm font-semibold text-neovantas-muted">{formatNumber(row.count)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[12px] border border-dashed border-neovantas-line bg-neovantas-mist px-4 py-6 text-sm text-neovantas-muted">
          {emptyLabel}
        </div>
      )}
    </Card>
  );
}

function UnauthorizedState() {
  return (
    <Card className="mx-auto max-w-2xl p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#FFF1E5] text-[#C2410C]">
        <ShieldAlert className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold text-neovantas-navy">No tienes permisos para acceder a esta sección</h1>
      <p className="mt-3 text-sm leading-6 text-neovantas-muted">
        La analítica de uso está reservada para administradores autorizados.
      </p>
    </Card>
  );
}

export function AdminUsagePage() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [userEmail, setUserEmail] = useState('');
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    fetchClientPrincipal()
      .then((principal) => {
        if (!mounted) {
          return;
        }

        const email = principal?.userDetails?.trim() ?? '';
        setUserEmail(email);

        const allowed = isAdminUser(email) || isAdminRoleMember(principal?.userRoles ?? []);
        setAuthState(allowed ? 'admin' : 'forbidden');
      })
      .catch(() => {
        if (mounted) {
          setAuthState('forbidden');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (authState !== 'admin') {
      return;
    }

    let mounted = true;
    const controller = new AbortController();

    fetch('/api/usage/summary', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Usage metrics request failed: ${response.status}`);
        }

        return response.json() as Promise<UsageSummary>;
      })
      .then((payload) => {
        if (mounted) {
          setSummary(payload ?? DEFAULT_SUMMARY);
        }
      })
      .catch((requestError) => {
        if (mounted) {
          setSummary(DEFAULT_SUMMARY);
          setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar las métricas.');
        }
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [authState]);

  const resolvedSummary = summary ?? DEFAULT_SUMMARY;
  const totalAccesses = resolvedSummary.totals?.accessesTotal ?? 0;
  const uniqueUsers = resolvedSummary.totals?.uniqueUsers ?? 0;
  const topSections = useMemo(() => normalizeRows(resolvedSummary.sections ?? resolvedSummary.topSections), [resolvedSummary]);
  const topLinks = useMemo(() => normalizeRows(resolvedSummary.links ?? resolvedSummary.topLinks), [resolvedSummary]);
  const activityByDay = useMemo(() => normalizeRows(resolvedSummary.activityByDay), [resolvedSummary]);
  const activityByUser = useMemo(() => normalizeRows(resolvedSummary.activityByUser), [resolvedSummary]);

  if (authState === 'loading') {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="Uso de la intranet"
          description="Comprobando permisos de acceso a la analítica..."
        />
        <Card className="p-8 text-sm text-neovantas-muted">Verificando sesión de Microsoft 365...</Card>
      </div>
    );
  }

  if (authState === 'forbidden') {
    return (
      <div className="space-y-5">
        <SectionHeader title="Uso de la intranet" description="Analítica privada para administradores." />
        <UnauthorizedState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Uso de la intranet"
        description="Analítica privada para administradores autorizados."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Accesos totales"
          value={formatNumber(totalAccesses)}
          icon={Activity}
          note="Sesiones, vistas o interacciones registradas por el tracking."
        />
        <MetricCard
          title="Usuarios únicos"
          value={formatNumber(uniqueUsers)}
          icon={Users}
          note="Personas distintas que han usado la intranet en el periodo."
        />
        <MetricCard
          title="Secciones más visitadas"
          value={formatNumber(topSections.length)}
          icon={BarChart3}
          note="Bloques con más tráfico en la intranet."
        />
        <MetricCard
          title="Enlaces más pulsados"
          value={formatNumber(topLinks.length)}
          icon={MousePointerClick}
          note="Accesos directos con más interacción."
        />
      </div>

      {error ? (
        <Card className="border-[#FED7AA] bg-[#FFFBF5] p-4 text-sm text-[#9A3412]">
          {error}. Se muestra la página, pero no se han podido cargar las métricas del endpoint.
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedList
          title="Secciones más visitadas"
          icon={ChartColumn}
          rows={topSections}
          emptyLabel="No hay datos de secciones todavía."
        />
        <RankedList
          title="Enlaces más pulsados"
          icon={MousePointerClick}
          rows={topLinks}
          emptyLabel="No hay datos de enlaces todavía."
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ActivityList
          title="Actividad por día"
          rows={activityByDay.map((row) => ({ ...row, label: formatDateLabel(row.label) }))}
          emptyLabel="No hay actividad diaria disponible."
        />
        <ActivityList
          title="Actividad por usuario"
          rows={activityByUser}
          emptyLabel="No hay actividad por usuario disponible."
        />
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-neovantas-navy">Autorización activa</p>
            <p className="mt-1 text-sm text-neovantas-muted">
              Usuario autenticado: {userEmail || 'desconocido'}
            </p>
          </div>
          <Badge tone="success">Admin</Badge>
        </div>
        <p className="mt-4 text-sm leading-6 text-neovantas-muted">
          La autorización está preparada para migrar a un grupo de Microsoft Entra ID llamado{' '}
          <span className="font-semibold text-neovantas-navy">Intranet Admins</span> sin cambiar la ruta.
        </p>
      </Card>
    </div>
  );
}
