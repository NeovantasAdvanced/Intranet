import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Database,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  Files,
  FolderOpen,
  LifeBuoy,
  Newspaper,
  Rocket,
  SearchX,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import quickLinksData from '../data/quickLinks.json';
import assistantsData from '../data/assistants.json';
import newsData from '../data/news.json';
import documentsData from '../data/documents.json';
import sharePointCatalogData from '../data/sharepointCatalog.json';
import appsData from '../data/apps.json';
import roadmapData from '../data/roadmap.json';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { usePortalSearch } from '../context/PortalSearchContext';
import type {
  Assistant,
  DocumentItem,
  InternalApp,
  NewsItem,
  QuickLink,
  RoadmapItem,
  SharePointCatalog,
  SharePointResourceScope,
} from '../types/content';

const quickLinks = quickLinksData as QuickLink[];
const assistants = assistantsData as Assistant[];
const news = newsData as NewsItem[];
const documents = documentsData as DocumentItem[];
const sharePointCatalog = sharePointCatalogData as SharePointCatalog;
const sharePointRepositories = sharePointCatalog.repositories;
const sharePointResources = sharePointCatalog.resources;
const apps = appsData as InternalApp[];
const roadmap = roadmapData as RoadmapItem[];

type RepositoryFilterId = 'all' | SharePointResourceScope | 'files';

const repositoryFilters: { id: RepositoryFilterId; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'team', label: 'Equipo' },
  { id: 'projects', label: 'Proyectos' },
  { id: 'files', label: 'Ficheros' },
];

const iconMap = {
  users: Users,
  'life-buoy': LifeBuoy,
  calendar: CalendarDays,
  rocket: Rocket,
  briefcase: BriefcaseBusiness,
  clock: Clock3,
  database: Database,
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

  const searchQuery = normalizeSearch(searchValue);
  const isSearching = searchQuery.length > 0;

  const filteredContent = useMemo(
    () => ({
      quickLinks: quickLinks.filter((item) =>
        matchesQuery(searchQuery, [item.title, item.description, item.status]),
      ),
      assistants: assistants.filter((item) =>
        matchesQuery(searchQuery, [
          item.title,
          item.description,
          item.owner,
          item.status,
          item.tags,
        ]),
      ),
      news: news.filter((item) =>
        matchesQuery(searchQuery, [item.title, item.excerpt, item.category, item.status]),
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
          item.status,
          item.tags,
        ]),
      ),
      apps: apps.filter((item) =>
        matchesQuery(searchQuery, [item.title, item.description, item.owner, item.status]),
      ),
      roadmap: roadmap.filter((item) =>
        matchesQuery(searchQuery, [item.title, item.description, item.quarter, item.status]),
      ),
    }),
    [searchQuery],
  );

  const visibleSharePointResources = useMemo(() => {
    if (repositoryFilter === 'all') {
      return filteredContent.sharePointResources;
    }

    if (repositoryFilter === 'files') {
      return filteredContent.sharePointResources.filter((item) => item.itemType === 'file');
    }

    return filteredContent.sharePointResources.filter((item) => item.scope === repositoryFilter);
  }, [filteredContent.sharePointResources, repositoryFilter]);

  const totalResults =
    filteredContent.quickLinks.length +
    filteredContent.assistants.length +
    filteredContent.news.length +
    filteredContent.documents.length +
    filteredContent.sharePointResources.length +
    filteredContent.apps.length +
    filteredContent.roadmap.length;

  return (
    <div className="space-y-8">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg bg-neovantas-navy p-6 text-white shadow-panel md:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge tone="info" className="border-sky-300/30 bg-sky-300/10 text-sky-100">
                Portal corporativo MVP
              </Badge>
              <h2 className="mt-5 text-3xl font-semibold leading-tight md:text-4xl">
                Tu hub diario para trabajar mejor en Neovantas
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Accesos rapidos, asistentes internos, documentacion, noticias y estado de aplicaciones en
                una unica experiencia preparada para Azure Static Web Apps.
              </p>
            </div>

            <a
              href="#mesa-ia"
              className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-neovantas-navy shadow-sm"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Abrir Mesa IA
            </a>
          </div>
        </div>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">Estado del portal</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">MVP listo</h3>
            </div>
            <Badge tone="success">Operativo</Badge>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-2xl font-semibold text-slate-950">{quickLinks.length}</p>
              <p className="mt-1 text-xs text-slate-500">Accesos</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-2xl font-semibold text-slate-950">{assistants.length}</p>
              <p className="mt-1 text-xs text-slate-500">GPTs</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-2xl font-semibold text-slate-950">{sharePointRepositories.length}</p>
              <p className="mt-1 text-xs text-slate-500">Repos</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-2xl font-semibold text-slate-950">{apps.length}</p>
              <p className="mt-1 text-xs text-slate-500">Apps</p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-600">
            La autenticacion real no esta conectada todavia. El layout ya reserva el punto de entrada para
            Microsoft 365 y Entra ID.
          </p>
        </Card>
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

      {(!isSearching || filteredContent.quickLinks.length > 0) ? (
      <section>
        <SectionHeader
          title="Accesos rapidos"
          description="Atajos operativos para las tareas mas frecuentes."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredContent.quickLinks.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap] ?? ArrowRight;

            return (
              <Card key={item.id} className="p-4 transition hover:-translate-y-0.5 hover:border-slate-300">
                <a href={item.href} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-neovantas-navy">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <Badge tone={item.tone}>{item.status}</Badge>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                </a>
              </Card>
            );
          })}
        </div>
      </section>
      ) : null}

      {(!isSearching || filteredContent.assistants.length > 0 || filteredContent.roadmap.length > 0) ? (
      <section id="mesa-ia" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {(!isSearching || filteredContent.assistants.length > 0) ? (
        <div>
          <SectionHeader
            title="GPTs y asistentes"
            description="Herramientas internas para acelerar conocimiento, delivery y soporte."
            action={
              <a
                href="#asistentes"
                className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              >
                Ver todos
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            }
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {filteredContent.assistants.map((assistant) => (
              <Card key={assistant.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-sky-50 text-neovantas-blue">
                    <Bot className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <Badge tone={assistant.tone}>{assistant.status}</Badge>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">{assistant.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{assistant.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {assistant.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-500">{assistant.owner}</span>
                  <a href={assistant.href} className="font-semibold text-neovantas-blue">
                    Abrir
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </div>
        ) : null}

        {(!isSearching || filteredContent.roadmap.length > 0) ? (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-neovantas-teal" aria-hidden="true" />
              <h3 className="text-base font-semibold text-slate-950">Mesa IA</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Espacio para gestionar demanda, buenas practicas, riesgos y adopcion de IA generativa.
            </p>
          </div>
          <div className="divide-y divide-slate-200">
            {filteredContent.roadmap.map((item) => (
              <div key={item.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">{item.quarter}</p>
                    <h4 className="mt-1 text-sm font-semibold text-slate-950">{item.title}</h4>
                  </div>
                  <Badge tone={item.tone}>{item.status}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </Card>
        ) : null}
      </section>
      ) : null}

      {(!isSearching || filteredContent.sharePointResources.length > 0) ? (
      <section id="repositorios">
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
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
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

          {visibleSharePointResources.length > 0 ? (
            <div className="max-h-[560px] divide-y divide-slate-200 overflow-y-auto">
              {visibleSharePointResources.map((item) => {
                const ResourceIcon = item.itemType === 'file' ? FileSpreadsheet : FolderOpen;

                return (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50 md:flex-row md:items-start"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-neovantas-teal">
                      <ResourceIcon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.tone}>{item.status}</Badge>
                        <span className="text-xs font-medium text-slate-500">{item.category}</span>
                        <span className="text-xs text-slate-400">{item.repository}</span>
                      </div>
                      <h4 className="mt-2 text-sm font-semibold text-slate-950">{item.title}</h4>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-4 text-sm text-slate-500 md:w-44 md:justify-end">
                      <span>
                        {item.itemType === 'file'
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

      {(!isSearching || filteredContent.news.length > 0 || filteredContent.documents.length > 0) ? (
      <section className="grid gap-5 xl:grid-cols-2">
        {(!isSearching || filteredContent.news.length > 0) ? (
        <div>
          <SectionHeader title="Noticias" description="Comunicaciones relevantes para el equipo." />
          <div className="space-y-3">
            {filteredContent.news.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={item.tone}>{item.status}</Badge>
                      <span className="text-xs font-medium text-slate-500">{item.category}</span>
                      <span className="text-xs text-slate-400">{formatDate(item.date)}</span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.excerpt}</p>
                  </div>
                  <Newspaper className="hidden h-5 w-5 shrink-0 text-slate-400 sm:block" aria-hidden="true" />
                </div>
              </Card>
            ))}
          </div>
        </div>
        ) : null}

        {(!isSearching || filteredContent.documents.length > 0) ? (
        <div>
          <SectionHeader title="Documentacion" description="Recursos versionados y listos para enlazar." />
          <div className="space-y-3">
            {filteredContent.documents.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-neovantas-teal">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={item.tone}>{item.status}</Badge>
                      <span className="text-xs text-slate-500">{item.area}</span>
                      <span className="text-xs text-slate-400">Rev. {formatDate(item.updatedAt)}</span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
        ) : null}
      </section>
      ) : null}

      {(!isSearching || filteredContent.apps.length > 0) ? (
      <section>
        <SectionHeader title="Aplicaciones internas" description="Servicios conectables en proximas iteraciones." />
        <div className="grid gap-4 md:grid-cols-3">
          {filteredContent.apps.map((app) => {
            const Icon = iconMap[app.icon as keyof typeof iconMap] ?? BriefcaseBusiness;

            return (
              <Card key={app.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-neovantas-navy">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <Badge tone={app.tone}>{app.status}</Badge>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">{app.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{app.description}</p>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-500">{app.owner}</span>
                  <a href={app.href} className="font-semibold text-neovantas-blue">
                    Acceder
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
      ) : null}
    </div>
  );
}
