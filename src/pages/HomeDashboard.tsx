import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  Files,
  FolderOpen,
  KeyRound,
  LifeBuoy,
  Newspaper,
  Rocket,
  SearchX,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import quickLinksData from '../data/quickLinks.json';
import newsData from '../data/news.json';
import documentsData from '../data/documents.json';
import sharePointCatalogData from '../data/sharepointCatalog.json';
import appsData from '../data/apps.json';
import launchPlanData from '../data/roadmap.json';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { usePortalSearch } from '../context/PortalSearchContext';
import type {
  DocumentItem,
  InternalApp,
  NewsItem,
  QuickLink,
  SharePointCatalog,
  SharePointResourceScope,
  RoadmapItem,
} from '../types/content';

const quickLinks = quickLinksData as QuickLink[];
const news = newsData as NewsItem[];
const documents = documentsData as DocumentItem[];
const sharePointCatalog = sharePointCatalogData as SharePointCatalog;
const sharePointRepositories = sharePointCatalog.repositories;
const sharePointResources = sharePointCatalog.resources;
const apps = appsData as InternalApp[];
const launchPlan = launchPlanData as RoadmapItem[];

type RepositoryFilterId =
  | 'all'
  | SharePointResourceScope
  | 'files'
  | 'folders'
  | 'projectSheets'
  | 'finalDocs';

const repositoryFilters: { id: RepositoryFilterId; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'team', label: 'Equipo' },
  { id: 'projects', label: 'Proyectos' },
  { id: 'files', label: 'Ficheros' },
  { id: 'projectSheets', label: 'Fichas' },
  { id: 'finalDocs', label: 'Docs finales' },
  { id: 'folders', label: 'Carpetas' },
];

const iconMap = {
  users: Users,
  'life-buoy': LifeBuoy,
  calendar: CalendarDays,
  rocket: Rocket,
  briefcase: BriefcaseBusiness,
  clock: Clock3,
  database: Database,
  key: KeyRound,
};

type SearchableValue = string | string[] | undefined;

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesQuery(query: string, values: SearchableValue[]) {
  if (!query) {
    return true;
  }

  const haystack = normalizeSearch(
    values
      .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
      .join(' '),
  );

  return haystack.includes(query);
}

function matchesRepositoryFilter(filterId: RepositoryFilterId, item: (typeof sharePointResources)[number]) {
  if (filterId === 'all') {
    return true;
  }

  if (filterId === 'files') {
    return item.itemType === 'file';
  }

  if (filterId === 'folders') {
    return item.itemType === 'folder';
  }

  if (filterId === 'projectSheets') {
    return normalizeSearch(item.category).includes('ficha');
  }

  if (filterId === 'finalDocs') {
    return normalizeSearch(item.category).includes('documento final');
  }

  return item.scope === filterId;
}

function withDownloadParam(href: string) {
  if (href.includes('download=1')) {
    return href;
  }

  return `${href}${href.includes('?') ? '&' : '?'}download=1`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function HomeDashboard() {
  const { searchValue, setSearchValue } = usePortalSearch();
  const [repositoryFilter, setRepositoryFilter] = useState<RepositoryFilterId>('all');
  const [projectFilter, setProjectFilter] = useState('all');

  const searchQuery = normalizeSearch(searchValue);
  const isSearching = searchQuery.length > 0;

  const filteredContent = useMemo(
    () => ({
      quickLinks: quickLinks.filter((item) =>
        matchesQuery(searchQuery, [item.title, item.description, item.status]),
      ),
      news: news.filter((item) =>
        matchesQuery(searchQuery, [item.title, item.excerpt, item.category, item.status, item.source]),
      ),
      documents: documents.filter((item) =>
        matchesQuery(searchQuery, [item.title, item.description, item.area, item.status]),
      ),
      sharePointResources: sharePointResources.filter((item) =>
        matchesQuery(searchQuery, [
          item.title,
          item.description,
          item.repository,
          item.category,
          item.parentTitle,
          item.path,
          item.status,
          item.tags,
        ]),
      ),
      apps: apps.filter((item) =>
        matchesQuery(searchQuery, [item.title, item.description, item.owner, item.status]),
      ),
    }),
    [searchQuery],
  );

  const visibleSharePointResources = useMemo(() => {
    return filteredContent.sharePointResources.filter((item) => {
      const projectName = item.parentTitle ?? (item.scope === 'projects' && item.itemType === 'folder' ? item.title : '');

      return (
        matchesRepositoryFilter(repositoryFilter, item) &&
        (projectFilter === 'all' || projectName === projectFilter)
      );
    });
  }, [filteredContent.sharePointResources, projectFilter, repositoryFilter]);

  const projectFilterOptions = useMemo(() => {
    const projectNames = new Set<string>();

    sharePointResources.forEach((item) => {
      if (item.scope !== 'projects') {
        return;
      }

      const projectName = item.parentTitle ?? (item.itemType === 'folder' ? item.title : undefined);

      if (projectName) {
        projectNames.add(projectName);
      }
    });

    return Array.from(projectNames).sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }));
  }, []);

  const sharePointStats = useMemo(() => {
    const projectResources = sharePointResources.filter((item) => item.scope === 'projects');

    return {
      total: sharePointResources.length,
      projects: projectResources.filter((item) => item.itemType === 'folder').length,
      projectSheets: projectResources.filter((item) => normalizeSearch(item.category).includes('ficha')).length,
      finalDocs: projectResources.filter((item) => normalizeSearch(item.category).includes('documento final')).length,
    };
  }, []);

  const totalResults =
    filteredContent.quickLinks.length +
    filteredContent.news.length +
    filteredContent.documents.length +
    filteredContent.sharePointResources.length +
    filteredContent.apps.length;

  const priorityLinks = ['herramientas-passwords', 'personas', 'soporte', 'calendario', 'onboarding'];
  const orderedQuickLinks = [...filteredContent.quickLinks].sort((left, right) => {
    const leftRank = priorityLinks.indexOf(left.id);
    const rightRank = priorityLinks.indexOf(right.id);

    if (leftRank === -1 && rightRank === -1) {
      return left.title.localeCompare(right.title, 'es', { sensitivity: 'base' });
    }

    if (leftRank === -1) {
      return 1;
    }

    if (rightRank === -1) {
      return -1;
    }

    return leftRank - rightRank;
  });

  const featuredQuickLinks = orderedQuickLinks.slice(0, 2);
  const secondaryQuickLinks = orderedQuickLinks.slice(2);
  const newsItems = filteredContent.news.slice(0, 3);
  const documentItems = filteredContent.documents.slice(0, 4);
  const launchItems = launchPlan;

  return (
    <div className="space-y-8">
      <section
        id="inicio"
        className="scroll-mt-40 overflow-hidden rounded-[20px] bg-gradient-to-br from-neovantas-navy via-neovantas-blue to-[#123D74] p-6 text-white shadow-elevated md:p-8 lg:p-10"
      >
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-stretch">
          <div className="flex h-full flex-col justify-between gap-8">
            <div className="max-w-3xl">
              <Badge tone="info" className="border-white/20 bg-white/10 text-white">
                Portal ejecutivo
              </Badge>
              <h1 className="mt-5 font-display text-4xl font-normal leading-tight md:text-5xl">
                Portal de Recursos Neovantas
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/80 md:text-base">
                Una entrada unica para consultar conocimiento, proyectos, noticias, accesos y herramientas
                internas con una experiencia clara para directivos y consultores.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:max-w-2xl">
              <a
                href="#repositorios"
                className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-neovantas-navy shadow-sm"
              >
                Ver repositorios
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#documentacion"
                className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                Documentacion
              </a>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[14px] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                <p className="text-sm font-semibold text-white/60">Estado del portal</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Operativo</h2>
              </div>
              <Badge tone="success" className="border-emerald-300/30 bg-emerald-300/10 text-emerald-100">
                En linea
              </Badge>
            </div>
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-sm font-medium text-white/60">Autenticacion Microsoft 365</p>
              <p className="mt-2 text-sm leading-6 text-white/80">
                El portal entra por Entra ID en Azure Static Web Apps y protege las rutas internas.
                El contenido se sincroniza desde SharePoint y correo corporativo.
              </p>
            </div>
          </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[14px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-3xl font-semibold text-white">{quickLinks.length}</p>
                <p className="mt-1 text-sm text-white/60">Accesos clave</p>
              </div>
              <div className="rounded-[14px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-3xl font-semibold text-white">{sharePointStats.total}</p>
                <p className="mt-1 text-sm text-white/60">Recursos SharePoint</p>
              </div>
              <div className="rounded-[14px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-3xl font-semibold text-white">{sharePointStats.projects}</p>
                <p className="mt-1 text-sm text-white/60">Proyectos catalogados</p>
              </div>
              <div className="rounded-[14px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-3xl font-semibold text-white">{apps.length}</p>
                <p className="mt-1 text-sm text-white/60">Aplicaciones internas</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isSearching ? (
        <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-50 text-neovantas-blue">
              <SearchX className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">
                {totalResults === 1 ? '1 resultado encontrado' : `${totalResults} resultados encontrados`}
              </p>
              <p className="mt-1 truncate text-sm text-slate-500">Busqueda activa: {searchValue}</p>
            </div>
          </div>
          <button
            type="button"
            className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
            onClick={() => setSearchValue('')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Limpiar
          </button>
        </Card>
      ) : null}

      {isSearching && totalResults === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-slate-100 text-slate-500">
            <SearchX className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-950">Sin resultados</h3>
          <p className="mt-2 text-sm text-slate-600">
            Prueba con otro termino o limpia la busqueda para ver todo el portal.
          </p>
        </Card>
      ) : null}

      {(!isSearching || orderedQuickLinks.length > 0) ? (
        <section id="accesos" className="scroll-mt-40">
          <SectionHeader
            title="Accesos frecuentes"
            description="Opciones ordenadas por uso habitual para entrar antes a lo más consultado."
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Card className="p-0 overflow-hidden">
              <div className="border-b border-neovantas-line bg-neovantas-mist px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neovantas-muted">
                  Accesos prioritarios
                </p>
                <p className="mt-1 text-sm text-neovantas-muted">
                  Los primeros accesos son los que más se usan en el trabajo diario.
                </p>
              </div>
              <div className="divide-y divide-neovantas-line">
                {featuredQuickLinks.map((item) => {
                  const Icon = iconMap[item.icon as keyof typeof iconMap] ?? ArrowRight;

                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      className="flex items-center gap-4 px-5 py-4 transition hover:bg-neovantas-mist"
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[#EBF2FE] text-neovantas-blue">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="truncate text-[15px] font-semibold text-neovantas-navy">{item.title}</h3>
                          <Badge tone={item.tone}>{item.status}</Badge>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-neovantas-muted">{item.description}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="border-b border-neovantas-line bg-neovantas-mist px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neovantas-muted">
                  Más utilizados
                </p>
              </div>
              <div className="divide-y divide-neovantas-line">
                {secondaryQuickLinks.map((item) => {
                  const Icon = iconMap[item.icon as keyof typeof iconMap] ?? ArrowRight;

                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      className="flex items-center gap-3 px-5 py-4 transition hover:bg-neovantas-mist"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white text-neovantas-blue shadow-sm">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate text-sm font-semibold text-neovantas-navy">{item.title}</h3>
                          <span className="text-xs text-neovantas-muted">{item.status}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-neovantas-muted">{item.description}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </Card>
          </div>
        </section>
      ) : null}

      {(!isSearching || newsItems.length > 0 || documentItems.length > 0) ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          {(!isSearching || newsItems.length > 0) ? (
            <div id="noticias" className="scroll-mt-40">
              <SectionHeader title="Noticias" description="Comunicaciones recientes para el equipo." />
              <Card className="overflow-hidden">
                <div className="divide-y divide-neovantas-line">
                  {newsItems.map((item) => (
                    <a
                      key={item.id}
                      href={item.href ?? '#'}
                      target={item.href ? '_blank' : undefined}
                      rel={item.href ? 'noreferrer' : undefined}
                      className="flex items-start gap-4 px-5 py-4 transition hover:bg-neovantas-mist"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#EEF8FF] text-neovantas-blue">
                        <Newspaper className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={item.tone}>{item.status}</Badge>
                          <span className="text-xs font-medium text-neovantas-muted">{item.category}</span>
                          <span className="text-xs text-neovantas-muted">{formatDate(item.date)}</span>
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-neovantas-navy">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-neovantas-muted">{item.excerpt}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {(!isSearching || documentItems.length > 0) ? (
            <div id="documentacion" className="scroll-mt-40">
              <SectionHeader title="Documentacion" description="Recursos versionados y listos para enlazar." />
              <Card className="overflow-hidden">
                <div className="divide-y divide-neovantas-line">
                  {documentItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-4 px-5 py-4">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#EAFBF2] text-neovantas-teal">
                        <FileText className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={item.tone}>{item.status}</Badge>
                          <span className="text-xs text-neovantas-muted">{item.area}</span>
                          <span className="text-xs text-neovantas-muted">Rev. {formatDate(item.updatedAt)}</span>
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-neovantas-navy">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-neovantas-muted">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}
        </section>
      ) : null}

      {(!isSearching || filteredContent.sharePointResources.length > 0) ? (
      <section id="repositorios" className="scroll-mt-40">
        <SectionHeader
          title="Repositorios SharePoint"
          description="Acceso centralizado a documentacion del equipo y repositorio de proyectos realizados."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {sharePointRepositories.map((repository) => (
            <Card key={repository.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-sky-50 text-neovantas-blue">
                  <Files className="h-5 w-5" aria-hidden="true" />
                </div>
                <Badge tone={repository.tone}>{repository.status}</Badge>
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">{repository.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{repository.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {repository.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-sm">
                <div>
                  <p className="font-semibold text-slate-950">{repository.resourceCount}</p>
                  <p className="mt-1 text-xs text-slate-500">Recursos</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-950">{repository.owner}</p>
                  <p className="mt-1 text-xs text-slate-500">Owner</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-950">{formatDate(repository.updatedAt)}</p>
                  <p className="mt-1 text-xs text-slate-500">Revision</p>
                </div>
              </div>
              <a
                href={repository.href}
                target="_blank"
                rel="noreferrer"
                className="focus-ring mt-5 inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              >
                Abrir repositorio
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </Card>
          ))}
        </div>

        <Card className="mt-4 overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-neovantas-teal" aria-hidden="true" />
                <h3 className="text-base font-semibold text-slate-950">Catalogo de recursos</h3>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {visibleSharePointResources.length === 1
                  ? '1 recurso visible'
                  : `${visibleSharePointResources.length} recursos visibles`}
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600">
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="sr-only">Filtrar por cliente o proyecto</span>
                <select
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
                  className="min-w-0 border-0 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                >
                  <option value="all">Todos los clientes</option>
                  {projectFilterOptions.map((projectName) => (
                    <option key={projectName} value={projectName}>
                      {projectName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros de repositorio">
                {repositoryFilters.map((filter) => {
                  const isActive = repositoryFilter === filter.id;

                  return (
                    <button
                      key={filter.id}
                      type="button"
                      aria-pressed={isActive}
                      className={`focus-ring h-9 rounded-lg border px-3 text-sm font-semibold transition ${
                        isActive
                          ? 'border-neovantas-blue bg-neovantas-blue text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                      onClick={() => setRepositoryFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-lg font-semibold text-slate-950">{sharePointStats.total}</p>
              <p className="mt-1 text-xs text-slate-500">Recursos</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-lg font-semibold text-slate-950">{sharePointStats.projects}</p>
              <p className="mt-1 text-xs text-slate-500">Proyectos</p>
            </div>
            <div className="rounded-lg bg-sky-50 p-3">
              <p className="text-lg font-semibold text-sky-900">{sharePointStats.projectSheets}</p>
              <p className="mt-1 text-xs text-sky-700">Fichas</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-lg font-semibold text-emerald-900">{sharePointStats.finalDocs}</p>
              <p className="mt-1 text-xs text-emerald-700">Docs finales</p>
            </div>
          </div>

          {visibleSharePointResources.length > 0 ? (
            <div className="max-h-[560px] divide-y divide-slate-200 overflow-y-auto">
              {visibleSharePointResources.map((item) => {
                const isCredentialResource = normalizeSearch(item.category).includes('credencial');
                const ResourceIcon = isCredentialResource ? KeyRound : item.itemType === 'file' ? FileSpreadsheet : FolderOpen;
                const href = isCredentialResource ? withDownloadParam(item.href) : item.href;

                return (
                  <a
                    key={item.id}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    download={isCredentialResource ? true : undefined}
                    className="focus-ring flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50 md:flex-row md:items-start"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-neovantas-teal">
                      <ResourceIcon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.tone}>{item.status}</Badge>
                        <span className="text-xs font-medium text-slate-500">{item.category}</span>
                        <span className="text-xs text-slate-400">
                          {item.parentTitle ? `${item.repository} / ${item.parentTitle}` : item.repository}
                        </span>
                      </div>
                      <h4 className="mt-2 text-sm font-semibold text-slate-950">{item.title}</h4>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-4 text-sm text-slate-500 md:w-44 md:justify-end">
                      <span>
                        {isCredentialResource
                          ? 'Descarga'
                          : item.itemType === 'file'
                          ? 'Archivo'
                          : item.itemCount === 1
                            ? '1 elemento'
                            : `${item.itemCount ?? 0} elementos`}
                      </span>
                      <ExternalLink className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-slate-100 text-slate-500">
                <SearchX className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">Sin recursos visibles</h3>
              <p className="mt-2 text-sm text-slate-600">
                Cambia el filtro de repositorio o limpia la busqueda activa.
              </p>
            </div>
          )}
        </Card>
      </section>
      ) : null}

      {(!isSearching || filteredContent.apps.length > 0) ? (
      <section id="aplicaciones" className="scroll-mt-40">
        <SectionHeader title="Aplicaciones internas" description="Servicios conectables en proximas iteraciones." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredContent.apps.map((app) => {
            const Icon = iconMap[app.icon as keyof typeof iconMap] ?? BriefcaseBusiness;
            const isDownloadLink = app.href.includes('.kdbx') || normalizeSearch(app.status).includes('keepass');

            return (
              <Card key={app.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#EBF2FE] text-neovantas-navy">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <Badge tone={app.tone}>{app.status}</Badge>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">{app.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{app.description}</p>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-500">{app.owner}</span>
                  <a
                    href={isDownloadLink ? withDownloadParam(app.href) : app.href}
                    target={app.href.startsWith('#') ? undefined : '_blank'}
                    rel={app.href.startsWith('#') ? undefined : 'noreferrer'}
                    download={isDownloadLink ? true : undefined}
                    className="inline-flex items-center gap-1.5 font-semibold text-neovantas-blue"
                  >
                    {isDownloadLink ? 'Descargar' : 'Acceder'}
                    {isDownloadLink ? <Download className="h-4 w-4" aria-hidden="true" /> : null}
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
      ) : null}

      {launchItems.length > 0 ? (
        <section id="lanzamiento" className="scroll-mt-40">
          <SectionHeader
            title="Gobierno mínimo y lanzamiento"
            description="Bloque de control para lanzar con orden, criterio y seguimiento visible."
          />

          <div className="grid gap-4 md:grid-cols-3">
            {launchItems.map((item) => (
              <Card key={item.id} className="p-5 transition hover:-translate-y-0.5 hover:border-neovantas-line">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neovantas-muted">
                      {item.quarter}
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-neovantas-navy">{item.title}</h3>
                  </div>
                  <Badge tone={item.tone}>{item.status}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-neovantas-muted">{item.description}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
