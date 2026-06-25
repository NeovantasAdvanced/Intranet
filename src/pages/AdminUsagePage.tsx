import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChartColumn,
  CircleSlash2,
  Download,
  MousePointerClick,
  RefreshCcw,
  ShieldAlert,
  UserRound,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { fetchClientPrincipal } from '../lib/auth';
import { isAdminUser, isOffice365AdminPrincipal } from '../lib/admin';
import { isAdmin as isAccessAdmin } from '../lib/accessControl';

type UsageMetricRow = {
  label: string;
  count: number;
  href?: string;
};

type MonthOption = {
  label: string;
  count: number;
};

type UsageUserRow = {
  label: string;
  count: number;
  pageviews?: number;
  sectionViews?: number;
  linkClicks?: number;
  uniqueSections?: number;
  uniqueLinks?: number;
  lastSeen?: string;
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
  months?: MonthOption[];
  selectedMonth?: string;
  storageMode?: 'table' | 'file';
  users?: UsageUserRow[];
  usersByActivity?: UsageUserRow[];
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
  months: [],
  selectedMonth: 'all',
  storageMode: 'file',
  users: [],
  usersByActivity: [],
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

function formatMonthLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
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

function UserStatsList({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: UsageUserRow[];
  emptyLabel: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#F0EEFF] text-[#5340B8]">
          <UserRound className="h-5 w-5" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-neovantas-navy">{title}</h3>
      </div>

      {rows.length > 0 ? (
        <div className="mt-5 space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="rounded-[12px] border border-neovantas-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neovantas-navy">{row.label}</p>
                  <p className="mt-1 text-xs text-neovantas-muted">
                    Último acceso: {row.lastSeen ? formatDateLabel(row.lastSeen.slice(0, 10)) : 'Sin dato'}
                  </p>
                </div>
                <Badge tone="neutral">{formatNumber(row.count)}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div className="rounded-[12px] bg-neovantas-mist px-3 py-2">
                  <p className="text-xs text-neovantas-muted">Accesos</p>
                  <p className="mt-1 font-semibold text-neovantas-navy">{formatNumber(row.count)}</p>
                </div>
                <div className="rounded-[12px] bg-neovantas-mist px-3 py-2">
                  <p className="text-xs text-neovantas-muted">Enlaces</p>
                  <p className="mt-1 font-semibold text-neovantas-navy">{formatNumber(row.linkClicks ?? 0)}</p>
                </div>
                <div className="rounded-[12px] bg-neovantas-mist px-3 py-2">
                  <p className="text-xs text-neovantas-muted">Secciones</p>
                  <p className="mt-1 font-semibold text-neovantas-navy">{formatNumber(row.sectionViews ?? 0)}</p>
                </div>
                <div className="rounded-[12px] bg-neovantas-mist px-3 py-2">
                  <p className="text-xs text-neovantas-muted">Páginas</p>
                  <p className="mt-1 font-semibold text-neovantas-navy">{formatNumber(row.pageviews ?? 0)}</p>
                </div>
              </div>
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

function AdminReturnLink() {
  return (
    <a
      href="/"
      className="focus-ring inline-flex items-center gap-2 rounded-full border border-neovantas-line bg-white px-4 py-2 text-sm font-semibold text-neovantas-navy shadow-sm transition hover:border-neovantas-blue hover:text-neovantas-blue"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Volver al inicio
    </a>
  );
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function AdminUsagePage() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [userEmail, setUserEmail] = useState('');
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');

  useEffect(() => {
    let mounted = true;

    fetchClientPrincipal()
      .then((principal) => {
        if (!mounted) {
          return;
        }

        const email = principal?.userDetails?.trim() ?? '';
        setUserEmail(email);

        const allowed = isAccessAdmin(email) || isAdminUser(email) || isOffice365AdminPrincipal(principal);
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

    const monthQuery = selectedMonth === 'all' ? '' : `?month=${encodeURIComponent(selectedMonth)}`;

    fetch(`/api/usage/summary${monthQuery}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Usage metrics request failed: ${response.status}`);
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.toLowerCase().includes('application/json')) {
          throw new Error(
            'Usage metrics endpoint did not return JSON. Configure a backend for /api/usage/summary in Azure Static Web Apps.',
          );
        }

        return response.json() as Promise<UsageSummary>;
      })
      .then((payload) => {
        if (mounted) {
          setSummary(payload ?? DEFAULT_SUMMARY);
          setError('');
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
  }, [authState, selectedMonth]);

  const resolvedSummary = summary ?? DEFAULT_SUMMARY;
  const totalAccesses = resolvedSummary.totals?.accessesTotal ?? 0;
  const uniqueUsers = resolvedSummary.totals?.uniqueUsers ?? 0;
  const topSections = useMemo(() => normalizeRows(resolvedSummary.sections ?? resolvedSummary.topSections), [resolvedSummary]);
  const topLinks = useMemo(() => normalizeRows(resolvedSummary.links ?? resolvedSummary.topLinks), [resolvedSummary]);
  const activityByDay = useMemo(() => normalizeRows(resolvedSummary.activityByDay), [resolvedSummary]);
  const activityByUser = useMemo(() => normalizeRows(resolvedSummary.activityByUser), [resolvedSummary]);
  const userStats = useMemo(
    () => [...(resolvedSummary.users ?? resolvedSummary.usersByActivity ?? [])].sort((left, right) => right.count - left.count),
    [resolvedSummary],
  );
  const monthOptions = useMemo(() => [...(resolvedSummary.months ?? [])], [resolvedSummary]);
  const storageMode = resolvedSummary.storageMode ?? 'file';
  const exportStamp = selectedMonth === 'all' ? 'all' : selectedMonth;
  const isLocalDev = import.meta.env.DEV;

  const handleDownloadJson = () => {
    const payload = {
      selectedMonth,
      exportedAt: new Date().toISOString(),
      summary: resolvedSummary,
    };

    downloadTextFile(
      `usage-metrics-${exportStamp}.json`,
      `${JSON.stringify(payload, null, 2)}\n`,
      'application/json',
    );
  };

  const handleDownloadUsersCsv = () => {
    const rows = [
      ['usuario', 'accesos', 'pageviews', 'secciones', 'enlaces', 'secciones_unicas', 'enlaces_unicos', 'ultimo_acceso'],
      ...userStats.map((row) => [
        row.label,
        row.count,
        row.pageviews ?? 0,
        row.sectionViews ?? 0,
        row.linkClicks ?? 0,
        row.uniqueSections ?? 0,
        row.uniqueLinks ?? 0,
        row.lastSeen ?? '',
      ]),
    ];

    const csv = `${rows.map((row) => row.map(escapeCsv).join(';')).join('\n')}\n`;
    downloadTextFile(`usage-users-${exportStamp}.csv`, csv, 'text/csv;charset=utf-8');
  };

  if (authState === 'loading') {
    return (
      <div className="space-y-5">
        <AdminReturnLink />
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
        <AdminReturnLink />
        <SectionHeader title="Uso de la intranet" description="Analítica privada para administradores." />
        <UnauthorizedState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminReturnLink />
      <SectionHeader
        title="Uso de la intranet"
        description="Analítica privada para administradores autorizados."
      />

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-neovantas-muted" htmlFor="usage-month-filter">
              Mes
            </label>
            <select
              id="usage-month-filter"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="focus-ring h-10 min-w-[15rem] rounded-[12px] border border-neovantas-line bg-white px-3 text-sm text-neovantas-navy"
            >
              <option value="all">Todos los meses</option>
              {monthOptions.map((month) => (
                <option key={month.label} value={month.label}>
                  {formatMonthLabel(month.label)} ({formatNumber(month.count)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedMonth('all')}
              className="focus-ring inline-flex items-center gap-2 rounded-full border border-neovantas-line bg-white px-4 py-2 text-sm font-semibold text-neovantas-navy shadow-sm transition hover:border-neovantas-blue hover:text-neovantas-blue"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Ver todo
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-neovantas-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neovantas-blue/90"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Descargar JSON
            </button>
            <button
              type="button"
              onClick={handleDownloadUsersCsv}
              className="focus-ring inline-flex items-center gap-2 rounded-full border border-neovantas-line bg-white px-4 py-2 text-sm font-semibold text-neovantas-navy shadow-sm transition hover:border-neovantas-blue hover:text-neovantas-blue"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Descargar CSV
            </button>
          </div>
        </div>
      </Card>

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
        <Card className="border-[#D6EAF8] bg-[#F6FBFF] p-4 text-sm text-neovantas-navy">
          <div className="flex items-start gap-3">
            <CircleSlash2 className="mt-0.5 h-4 w-4 shrink-0 text-neovantas-blue" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold text-neovantas-navy">
                {isLocalDev
                  ? 'Las métricas reales estarán disponibles en Azure cuando esté configurado el almacenamiento.'
                  : 'Las métricas no están disponibles todavía en este entorno.'}
              </p>
              <p className="text-sm text-neovantas-muted">
                {isLocalDev
                  ? 'En desarrollo local no se consulta /api/usage para evitar errores de infraestructura.'
                  : 'La página sigue disponible mientras se prepara el backend de analítica.'}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {storageMode === 'file' ? (
        <Card className="border-[#D6EAF8] bg-[#F6FBFF] p-4 text-sm text-neovantas-navy">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-neovantas-blue" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold text-neovantas-navy">Diagnóstico de almacenamiento</p>
              <p className="text-sm text-neovantas-muted">
                El almacenamiento de estadísticas está usando un fichero temporal. Para persistencia en Azure, configura
                `AZURE_STORAGE_CONNECTION_STRING` o `AzureWebJobsStorage` con Table Storage.
              </p>
            </div>
          </div>
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

      <UserStatsList
        title="Usuarios más activos"
        rows={userStats}
        emptyLabel="No hay actividad por usuario disponible."
      />

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
