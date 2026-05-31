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
} from '../types/content';

const quickLinks = quickLinksData as QuickLink[];
const news = newsData as NewsItem[];
const documents = documentsData as DocumentItem[];
const sharePointCatalog = sharePointCatalogData as SharePointCatalog;
const sharePointRepositories = sharePointCatalog.repositories;
const sharePointResources = sharePointCatalog.resources;
const apps = appsData as InternalApp[];

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

function getLinkProps(href: string) {
  return href.startsWith('#') ? {} : { target: '_blank', rel: 'noreferrer' as const };
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

  const priorityLinks = [
    'herramientas-passwords',
    'factorial',
    'chatgpt',
    'deepl',
    'canva',
    'personas',
    'soporte',
    'calendario',
    'onboarding',
  ];
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
  const featuredApps = apps.slice(0, 1);
  const secondaryApps = apps.slice(1);

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
                      {...getLinkProps(item.href)}
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
                      {...getLinkProps(item.href)}
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
                      {...getLinkProps(item.href ?? '#')}
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
            description="Acceso centralizado a la documentación del equipo y al repositorio de proyectos."
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="overflow-hidden p-0">
              <div className="border-b border-neovantas-line bg-neovantas-mist px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neovantas-muted">
                      Catálogo SharePoint
                    </p>
                    <p className="mt-1 text-sm text-neovantas-muted">
                      {visibleSharePointResources.length === 1
                        ? '1 recurso visible'
                        : `${visibleSharePointResources.length} recursos visibles`}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <label className="flex h-9 min-w-0 items-center gap-2 rounded-full border border-neovantas-line bg-white px-3 text-sm text-neovantas-muted">
                      <SlidersHorizontal className="h-4 w-4 shrink-0 text-neovantas-muted" aria-hidden="true" />
                      <span className="sr-only">Filtrar por cliente o proyecto</span>
                      <select
                        value={projectFilter}
                        onChange={(event) => setProjectFilter(event.target.value)}
                        className="min-w-0 border-0 bg-transparent text-sm font-semibold text-neovantas-ink outline-none"
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
                            className={`focus-ring h-9 rounded-full border px-3 text-sm font-semibold transition ${
                              isActive
                                ? 'border-neovantas-blue bg-neovantas-blue text-white'
                                : 'border-neovantas-line bg-white text-neovantas-muted hover:border-slate-300'
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
              </div>

              <div className="grid gap-3 border-b border-neovantas-line bg-white px-5 py-4 sm:grid-cols-4">
                <div className="rounded-[12px] bg-neovantas-mist p-3">
                  <p className="text-lg font-semibold text-neovantas-navy">{sharePointStats.total}</p>
                  <p className="mt-1 text-xs text-neovantas-muted">Recursos</p>
                </div>
                <div className="rounded-[12px] bg-neovantas-mist p-3">
                  <p className="text-lg font-semibold text-neovantas-navy">{sharePointStats.projects}</p>
                  <p className="mt-1 text-xs text-neovantas-muted">Proyectos</p>
                </div>
                <div className="rounded-[12px] bg-[#EEF8FF] p-3">
                  <p className="text-lg font-semibold text-neovantas-blue">{sharePointStats.projectSheets}</p>
                  <p className="mt-1 text-xs text-neovantas-muted">Fichas</p>
                </div>
                <div className="rounded-[12px] bg-[#EAFBF2] p-3">
                  <p className="text-lg font-semibold text-neovantas-teal">{sharePointStats.finalDocs}</p>
                  <p className="mt-1 text-xs text-neovantas-muted">Docs finales</p>
                </div>
              </div>

              {visibleSharePointResources.length > 0 ? (
                <div className="max-h-[560px] divide-y divide-neovantas-line overflow-y-auto">
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
                        className="focus-ring flex flex-col gap-3 px-5 py-4 transition hover:bg-neovantas-mist md:flex-row md:items-start"
                      >
                        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${isCredentialResource ? 'bg-[#FFF1E5] text-[#C2410C]' : 'bg-[#EEF8FF] text-neovantas-blue'}`}>
                          <ResourceIcon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={item.tone}>{item.status}</Badge>
                            <span className="text-xs font-medium text-neovantas-muted">{item.category}</span>
                            <span className="text-xs text-neovantas-muted">
                              {item.parentTitle ? `${item.repository} / ${item.parentTitle}` : item.repository}
                            </span>
                          </div>
                          <h4 className="mt-2 text-sm font-semibold text-neovantas-navy">{item.title}</h4>
                          <p className="mt-1 text-sm leading-6 text-neovantas-muted">{item.description}</p>
                        </div>
                        <div className="flex shrink-0 items-center justify-between gap-4 text-sm text-neovantas-muted md:w-44 md:justify-end">
                          <span>
                            {isCredentialResource
                              ? 'Descarga'
                              : item.itemType === 'file'
                              ? 'Archivo'
                              : item.itemCount === 1
                                ? '1 elemento'
                                : `${item.itemCount ?? 0} elementos`}
                          </span>
                          <ExternalLink className="h-4 w-4 text-neovantas-muted" aria-hidden="true" />
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-[12px] bg-neovantas-mist text-neovantas-muted">
                    <SearchX className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-neovantas-navy">Sin recursos visibles</h3>
                  <p className="mt-2 text-sm text-neovantas-muted">
                    Cambia el filtro de repositorio o limpia la búsqueda activa.
                  </p>
                </div>
              )}
            </Card>

            <div className="space-y-4">
              {sharePointRepositories.map((repository) => (
                <Card key={repository.id} className="p-5 transition hover:-translate-y-0.5 hover:border-neovantas-line">
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[#EEF8FF] text-neovantas-blue">
                      <Files className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <Badge tone={repository.tone}>{repository.status}</Badge>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-neovantas-navy">{repository.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-neovantas-muted">{repository.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {repository.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-neovantas-mist px-2.5 py-1 text-xs text-neovantas-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 border-t border-neovantas-line pt-4 text-sm">
                    <div>
                      <p className="font-semibold text-neovantas-navy">{repository.resourceCount}</p>
                      <p className="mt-1 text-xs text-neovantas-muted">Recursos</p>
                    </div>
                    <div>
                      <p className="font-semibold text-neovantas-navy">{repository.owner}</p>
                      <p className="mt-1 text-xs text-neovantas-muted">Owner</p>
                    </div>
                    <div>
                      <p className="font-semibold text-neovantas-navy">{formatDate(repository.updatedAt)}</p>
                      <p className="mt-1 text-xs text-neovantas-muted">Revisión</p>
                    </div>
                  </div>
                  <a
                    href={repository.href}
                    {...getLinkProps(repository.href)}
                    className="focus-ring mt-5 inline-flex h-9 w-fit items-center gap-2 rounded-full border border-neovantas-line bg-white px-3 text-sm font-semibold text-neovantas-muted"
                  >
                    Abrir repositorio
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {(!isSearching || apps.length > 0) ? (
        <section id="aplicaciones" className="scroll-mt-40">
          <SectionHeader
            title="Aplicaciones internas"
            description="Servicios operativos conectables en la intranet."
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card className="overflow-hidden p-0">
              <div className="border-b border-neovantas-line bg-neovantas-mist px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neovantas-muted">
                  Destacado
                </p>
                <p className="mt-1 text-sm text-neovantas-muted">
                  Acceso prioritario al archivo KeePass y a los recursos más sensibles del equipo.
                </p>
              </div>

              {featuredApps.map((app) => {
                const Icon = iconMap[app.icon as keyof typeof iconMap] ?? BriefcaseBusiness;
                const isDownloadLink = app.href.includes('.kdbx') || normalizeSearch(app.status).includes('keepass');

                return (
                  <div key={app.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-[12px] bg-[#FFF1E5] text-[#C2410C]">
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <Badge tone={app.tone}>{app.status}</Badge>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-neovantas-navy">{app.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-neovantas-muted">{app.description}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-neovantas-muted">{app.owner}</span>
                      <a
                        href={isDownloadLink ? withDownloadParam(app.href) : app.href}
                        {...getLinkProps(isDownloadLink ? withDownloadParam(app.href) : app.href)}
                        download={isDownloadLink ? true : undefined}
                        className="inline-flex items-center gap-1.5 rounded-full bg-neovantas-blue px-3 py-2 font-semibold text-white"
                      >
                        {isDownloadLink ? 'Descargar' : 'Acceder'}
                        {isDownloadLink ? <Download className="h-4 w-4" aria-hidden="true" /> : null}
                      </a>
                    </div>
                  </div>
                );
              })}
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              {secondaryApps.map((app) => {
                const Icon = iconMap[app.icon as keyof typeof iconMap] ?? BriefcaseBusiness;
                const isDownloadLink = app.href.includes('.kdbx') || normalizeSearch(app.status).includes('keepass');

                return (
                  <Card key={app.id} className="p-5 transition hover:-translate-y-0.5 hover:border-neovantas-line">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#EBF2FE] text-neovantas-blue">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <Badge tone={app.tone}>{app.status}</Badge>
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-neovantas-navy">{app.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-neovantas-muted">{app.description}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-neovantas-muted">{app.owner}</span>
                      <a
                        href={isDownloadLink ? withDownloadParam(app.href) : app.href}
                        {...getLinkProps(isDownloadLink ? withDownloadParam(app.href) : app.href)}
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
          </div>
        </section>
      ) : null}

    </div>
  );
}
