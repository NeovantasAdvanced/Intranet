import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
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
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import assistantsData from '../data/assistants.json';
import newsData from '../data/news.json';
import eventsData from '../data/events.json';
import documentsData from '../data/documents.json';
import sharePointCatalogData from '../data/sharepointCatalog.json';
import appsData from '../data/apps.json';
import supportAstData from '../data/supportAst.json';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { SearchBar } from '../components/ui/SearchBar';
import { usePortalSearch } from '../context/PortalSearchContext';
import { EventsSection } from '../components/events/EventsSection';
import { UpcomingEventsBlock } from '../components/events/UpcomingEventsBlock';
import { getTodayIso, isPastEvent, sortEventsAscending } from '../lib/events';
import type {
  Assistant,
  DocumentItem,
  InternalApp,
  EventItem,
  NewsItem,
  SharePointCatalog,
  SharePointResourceScope,
  SupportAstItem,
} from '../types/content';

const assistants = assistantsData as Assistant[];
const news = newsData as NewsItem[];
const events = eventsData as EventItem[];
const documents = documentsData as DocumentItem[];
const sharePointCatalog = sharePointCatalogData as SharePointCatalog;
const sharePointRepositories = sharePointCatalog.repositories;
const sharePointResources = sharePointCatalog.resources;
const apps = appsData as InternalApp[];
const supportAst = supportAstData as SupportAstItem[];

type HomeLink = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: NewsItem['tone'];
  actionLabel?: string;
  download?: boolean;
};

type HomeBlock = {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  icon: LucideIcon;
  iconClassName: string;
  panelClassName?: string;
  links: HomeLink[];
};

type PortalSearchResult = {
  id: string;
  title: string;
  description: string;
  href: string;
  section: string;
  icon: LucideIcon;
  tone: NewsItem['tone'];
};

const homeQuickLinks: HomeLink[] = [
  {
    title: 'ChatGPT',
    description: 'Asistente de redacción, análisis y apoyo diario.',
    href: 'https://chat.openai.com',
    icon: BriefcaseBusiness,
    tone: 'info',
    actionLabel: 'Abrir',
  },
  {
    title: 'Factorial',
    description: 'Gestión de personas, vacaciones y solicitudes internas.',
    href: 'https://id.factorialhr.com/login?&return_to=https%3A%2F%2Fapp.factorialhr.com%2Fdashboard',
    icon: Users,
    tone: 'success',
    actionLabel: 'Abrir',
  },
  {
    title: 'iRecursos',
    description: 'Imputación horaria a proyectos con acceso por VPN.',
    href: 'https://irecursos.neovantas.com:8443',
    icon: Clock3,
    tone: 'warning',
    actionLabel: 'Abrir',
  },
  {
    title: 'Creador de Slides',
    description: 'Genera presentaciones ejecutivas con estilo Neovantas.',
    href: 'https://chatgpt.com/g/g-6a0331e985d081918928a1765dda235d-creador-de-slides-neovantas',
    icon: Rocket,
    tone: 'info',
    actionLabel: 'Abrir',
  },
  {
    title: 'Evaluador de documentos',
    description: 'Audita estructura, claridad y calidad de documentos.',
    href: 'https://chatgpt.com/g/g-6a0ee263171c8191b155edbddf1332a2-auditor-de-calidad-de-documentos-neovantas',
    icon: FileText,
    tone: 'critical',
    actionLabel: 'Abrir',
  },
];

const homeBlocks: HomeBlock[] = [
  {
    title: 'Herramientas IA',
    description: 'Asistentes y GPTs internos para acelerar trabajo operativo y entregables.',
    href: '#aplicaciones',
    actionLabel: 'Ir a Aplicaciones',
    icon: BriefcaseBusiness,
    iconClassName: 'bg-[#EBF2FE] text-neovantas-blue',
    links: [
      homeQuickLinks[0],
      homeQuickLinks[3],
    ],
  },
  {
    title: 'Recursos y herramientas',
    description: 'Aplicaciones internas, gestión, productividad, diseño y formación.',
    href: '#aplicaciones',
    actionLabel: 'Ir a Aplicaciones',
    icon: Users,
    iconClassName: 'bg-[#F0EEFF] text-[#5340B8]',
    links: [
      homeQuickLinks[1],
      homeQuickLinks[2],
    ],
  },
  {
    title: 'Documentación',
    description: 'Carpetas documentales, políticas, guías y materiales internos.',
    href: '#documentacion',
    actionLabel: 'Ir a Documentación',
    icon: FileText,
    iconClassName: 'bg-[#E6F7F3] text-neovantas-teal',
    links: [
      {
        title: 'Políticas',
        description: 'Ir a documentación corporativa.',
        href: '#documentacion',
        icon: FileText,
        tone: 'success',
        actionLabel: 'Abrir',
      },
      homeQuickLinks[1],
    ],
  },
  {
    title: 'Repositorios',
    description: 'Acceso a conocimiento de banca y repositorio de proyectos.',
    href: '#repositorios',
    actionLabel: 'Ir a Repositorios',
    icon: Files,
    iconClassName: 'bg-[#FEF3E6] text-[#985D0F]',
    links: [
      {
        title: 'Banca',
        description: 'NotebookLM con conocimiento del área bancaria.',
        href: 'https://notebooklm.google.com/notebook/cc6fd8d2-a08d-4235-9e9e-83008d66335a',
        icon: Files,
        tone: 'warning',
        actionLabel: 'Abrir',
      },
      {
        title: 'GPT proyectos',
        description: 'Repositorio asistido para proyectos y entregables.',
        href: 'https://chatgpt.com/g/g-68f7400f6c54819189ba2f836487dfea-repositorio',
        icon: BriefcaseBusiness,
        tone: 'info',
        actionLabel: 'Abrir',
      },
    ],
  },
  {
    title: 'KeePass',
    description: 'Gestor seguro de contraseñas recomendado para proteger accesos y credenciales de trabajo.',
    href: 'https://neovantas.sharepoint.com/sites/AdvancedAnalytics/Documentos%20compartidos/Carpetas%20equipo%20Neovantas/Herramientas_Neovantas.kdbx?download=1',
    actionLabel: 'Descargar KeePass',
    icon: KeyRound,
    iconClassName: 'bg-[#E0FAF5] text-[#0A7A65]',
    panelClassName: 'keepass-home-card',
    links: [
      {
        title: 'Herramientas_Neovantas.kdbx',
        description: 'Archivo cifrado con accesos compartidos del equipo.',
        href: 'https://neovantas.sharepoint.com/sites/AdvancedAnalytics/Documentos%20compartidos/Carpetas%20equipo%20Neovantas/Herramientas_Neovantas.kdbx?download=1',
        icon: KeyRound,
        tone: 'success',
        actionLabel: 'Descargar',
        download: true,
      },
    ],
  },
];

const portalHomeBlocks: HomeBlock[] = [
  {
    title: 'KeePass',
    description: 'Gestor seguro de contraseñas recomendado para proteger accesos y credenciales de trabajo.',
    href: 'https://neovantas.sharepoint.com/sites/AdvancedAnalytics/Documentos%20compartidos/Carpetas%20equipo%20Neovantas/Herramientas_Neovantas.kdbx?download=1',
    actionLabel: 'Descargar KeePass',
    icon: KeyRound,
    iconClassName: 'bg-white/15 text-white',
    panelClassName: 'keepass-home-card',
    links: [
      {
        title: 'Herramientas_Neovantas.kdbx',
        description: 'Archivo cifrado con accesos compartidos del equipo.',
        href: 'https://neovantas.sharepoint.com/sites/AdvancedAnalytics/Documentos%20compartidos/Carpetas%20equipo%20Neovantas/Herramientas_Neovantas.kdbx?download=1',
        icon: KeyRound,
        tone: 'success',
        actionLabel: 'Descargar',
        download: true,
      },
    ],
  },
  {
    title: 'Herramientas IA',
    description: 'Asistentes y GPTs internos para acelerar trabajo operativo, research y entregables.',
    href: '#herramientas-ia',
    actionLabel: 'Ir a IA',
    icon: Bot,
    iconClassName: 'bg-[#EBF2FE] text-neovantas-blue',
    links: [homeQuickLinks[0], homeQuickLinks[3]],
  },
  {
    title: 'Recursos y herramientas',
    description: 'Aplicaciones internas, gestión, productividad, diseño y formación.',
    href: '#recursos-herramientas',
    actionLabel: 'Ir a Recursos',
    icon: Wrench,
    iconClassName: 'bg-[#F0EEFF] text-[#5340B8]',
    links: [homeQuickLinks[1], homeQuickLinks[2]],
  },
  {
    title: 'Documentación',
    description: 'Carpetas documentales, políticas, guías y materiales internos.',
    href: '#documentacion',
    actionLabel: 'Ir a Documentación',
    icon: FileText,
    iconClassName: 'bg-[#E6F7F3] text-neovantas-teal',
    links: [
      {
        title: 'Políticas',
        description: 'Ir a documentación corporativa.',
        href: '#documentacion',
        icon: FileText,
        tone: 'success',
        actionLabel: 'Abrir',
      },
      homeQuickLinks[1],
    ],
  },
  {
    title: 'Repositorios',
    description: 'Acceso a conocimiento de banca y repositorio de proyectos.',
    href: '#repositorios',
    actionLabel: 'Ir a Repositorios',
    icon: Files,
    iconClassName: 'bg-[#FEF3E6] text-[#985D0F]',
    links: [
      {
        title: 'Banca',
        description: 'NotebookLM con conocimiento del área bancaria.',
        href: 'https://notebooklm.google.com/notebook/cc6fd8d2-a08d-4235-9e9e-83008d66335a',
        icon: Files,
        tone: 'warning',
        actionLabel: 'Abrir',
      },
      {
        title: 'GPT proyectos',
        description: 'Repositorio asistido para proyectos y entregables.',
        href: 'https://chatgpt.com/g/g-68f7400f6c54819189ba2f836487dfea-repositorio',
        icon: BriefcaseBusiness,
        tone: 'info',
        actionLabel: 'Abrir',
      },
    ],
  },
  {
    title: 'Soporte AST',
    description: 'Canal operativo para incidencias, accesos, equipamiento y soporte tecnológico.',
    href: '#soporte-ast',
    actionLabel: 'Ir a Soporte',
    icon: LifeBuoy,
    iconClassName: 'bg-[#E0FAF5] text-[#0A7A65]',
    links: [
      {
        title: 'Portal AST',
        description: 'Alta y seguimiento de incidencias.',
        href: '#soporte-ast',
        icon: LifeBuoy,
        tone: 'info',
        actionLabel: 'Abrir',
      },
      {
        title: 'Accesos',
        description: 'Solicitudes de permisos y herramientas.',
        href: '#soporte-ast',
        icon: ShieldCheck,
        tone: 'warning',
        actionLabel: 'Abrir',
      },
    ],
  },
];

function HomeLinkCard({ item, compact = false }: { item: HomeLink; compact?: boolean }) {
  const Icon = item.icon;
  const href = item.download ? withDownloadParam(item.href) : item.href;

  return (
    <a
      href={href}
      {...getLinkProps(href)}
      download={item.download ? true : undefined}
      className={`focus-ring group flex items-start gap-3 rounded-[16px] border border-neovantas-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-neovantas-blue hover:shadow-panel ${
        compact ? 'min-h-[112px]' : 'min-h-[132px]'
      }`}
    >
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[12px] ${item.tone === 'success' ? 'bg-[#EAFBF2] text-neovantas-teal' : item.tone === 'warning' ? 'bg-[#FEF3E6] text-[#985D0F]' : item.tone === 'critical' ? 'bg-[#FFF1E5] text-[#C2410C]' : 'bg-[#EEF8FF] text-neovantas-blue'}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-neovantas-navy">{item.title}</h3>
          {item.actionLabel ? <span className="text-xs font-semibold text-neovantas-muted">{item.actionLabel}</span> : null}
        </div>
        <p className="mt-1 text-sm leading-6 text-neovantas-muted">{item.description}</p>
      </div>
    </a>
  );
}

function HomeBlockCard({ block }: { block: HomeBlock }) {
  const Icon = block.icon;

  return (
    <article className={`home-block-card ${block.panelClassName ?? ''}`}>
      <div className="home-block-top">
        <div className={`module-icon ${block.iconClassName}`}>
          <Icon className="h-[23px] w-[23px]" aria-hidden="true" />
        </div>
        <a href={block.href} className="home-block-open">
          {block.actionLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>

      <h3>{block.title}</h3>
      <p>{block.description}</p>

      <div className="home-block-links">
        {block.links.map((item) => {
          const href = item.download ? withDownloadParam(item.href) : item.href;
          return (
            <a key={item.title} href={href} {...getLinkProps(href)} download={item.download ? true : undefined}>
              {item.title}
            </a>
          );
        })}
      </div>
    </article>
  );
}

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
  bot: Bot,
  users: Users,
  'life-buoy': LifeBuoy,
  calendar: CalendarDays,
  rocket: Rocket,
  briefcase: BriefcaseBusiness,
  clock: Clock3,
  database: Database,
  key: KeyRound,
  shield: ShieldCheck,
  wrench: Wrench,
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
  return href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')
    ? {}
    : { target: '_blank', rel: 'noreferrer' as const };
}

const portalTabIds = [
  'inicio',
  'herramientas-ia',
  'recursos-herramientas',
  'documentacion',
  'repositorios',
  'eventos',
  'noticias',
  'soporte-ast',
] as const;

type PortalTabId = (typeof portalTabIds)[number];

function getActivePortalTab(): PortalTabId {
  if (typeof window === 'undefined') {
    return 'inicio';
  }

  const hash = window.location.hash.replace(/^#/, '');
  return portalTabIds.includes(hash as PortalTabId) ? (hash as PortalTabId) : 'inicio';
}

export function HomeDashboard() {
  const { searchValue, setSearchValue } = usePortalSearch();
  const [repositoryFilter, setRepositoryFilter] = useState<RepositoryFilterId>('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<PortalTabId>(getActivePortalTab);

  useEffect(() => {
    const handleHashChange = () => setActiveTab(getActivePortalTab());

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const searchQuery = normalizeSearch(searchValue);
  const isSearching = searchQuery.length > 0;
  const showHome = activeTab === 'inicio';
  const showIa = activeTab === 'herramientas-ia';
  const showResources = activeTab === 'recursos-herramientas';
  const showDocuments = activeTab === 'documentacion';
  const showRepositories = activeTab === 'repositorios';
  const showEvents = activeTab === 'eventos';
  const showNews = activeTab === 'noticias';
  const showSupport = activeTab === 'soporte-ast';

  const filteredContent = useMemo(
    () => ({
      assistants: assistants.filter((item) =>
        matchesQuery(searchQuery, [item.title, item.description, item.owner, item.status, item.tags]),
      ),
      news: news.filter((item) =>
        matchesQuery(searchQuery, [
          item.title,
          item.excerpt,
          item.summary,
          item.category,
          item.status,
          item.source,
          item.rawMeta?.newsletterSource,
          item.rawMeta?.briefingTitle,
          item.rawMeta?.dateText,
        ]),
      ),
      events: events.filter((item) =>
        matchesQuery(searchQuery, [
          item.title,
          item.organization,
          item.format,
          item.category,
          item.cta,
          item.source,
          item.tags,
          item.workSchedule,
        ]),
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
      supportAst: supportAst.filter((item) =>
        matchesQuery(searchQuery, [item.title, item.description, item.owner, item.status, item.phone]),
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

  const homeQuickLinkMatches = searchQuery
    ? homeQuickLinks.filter((item) => matchesQuery(searchQuery, [item.title, item.description])).length
    : homeQuickLinks.length;

  const totalResults =
    homeQuickLinkMatches +
    filteredContent.assistants.length +
    filteredContent.news.length +
    filteredContent.events.length +
    filteredContent.documents.length +
    filteredContent.sharePointResources.length +
    filteredContent.apps.length +
    filteredContent.supportAst.length;

  const resourceLinks = useMemo(
    () =>
      homeQuickLinks.filter((item) => {
        if (!searchQuery) {
          return true;
        }

        return matchesQuery(searchQuery, [item.title, item.description]);
      }),
    [searchQuery],
  );

  const todayIso = getTodayIso();
  const upcomingEvents = [...filteredContent.events]
    .filter((event) => !isPastEvent(event, todayIso))
    .sort(sortEventsAscending);
  const documentItems = filteredContent.documents.slice(0, 4);
  const featuredApps = filteredContent.apps.slice(0, 1);
  const secondaryApps = filteredContent.apps.slice(1);
  const latestNewsSource = 'Noticias relevantes de hoy';
  const latestNewsItems = filteredContent.news.filter(
    (item) => item.rawMeta?.newsletterSource === latestNewsSource || item.source === latestNewsSource,
  );
  const newsItems = (latestNewsItems.length > 0 ? latestNewsItems : filteredContent.news).slice(0, 3);
  const visibleNewsItems = showNews ? filteredContent.news : newsItems;
  const visibleDocumentItems = showDocuments ? filteredContent.documents : documentItems;
  const searchResults = useMemo<PortalSearchResult[]>(() => {
    if (!searchQuery) {
      return [];
    }

    const quickAccessResults = homeQuickLinks
      .filter((item) => matchesQuery(searchQuery, [item.title, item.description]))
      .map((item) => ({
        id: `quick-${item.title}`,
        title: item.title,
        description: item.description,
        href: item.download ? withDownloadParam(item.href) : item.href,
        section: 'Acceso rápido',
        icon: item.icon,
        tone: item.tone,
      }));

    return [
      ...quickAccessResults,
      ...filteredContent.assistants.map((item) => ({
        id: `assistant-${item.id}`,
        title: item.title,
        description: item.description,
        href: item.href,
        section: 'Herramientas IA',
        icon: Bot,
        tone: item.tone,
      })),
      ...filteredContent.apps.map((item) => ({
        id: `app-${item.id}`,
        title: item.title,
        description: item.description,
        href: item.href.includes('.kdbx') ? withDownloadParam(item.href) : item.href,
        section: 'Recursos y herramientas',
        icon: iconMap[item.icon as keyof typeof iconMap] ?? BriefcaseBusiness,
        tone: item.tone,
      })),
      ...filteredContent.documents.map((item) => ({
        id: `document-${item.id}`,
        title: item.title,
        description: item.description,
        href: item.href,
        section: 'Documentación',
        icon: FileText,
        tone: item.tone,
      })),
      ...filteredContent.sharePointResources.map((item) => ({
        id: `sharepoint-${item.id}`,
        title: item.title,
        description: item.description,
        href: normalizeSearch(item.category).includes('credencial') ? withDownloadParam(item.href) : item.href,
        section: 'Repositorios',
        icon: item.itemType === 'file' ? FileSpreadsheet : FolderOpen,
        tone: item.tone,
      })),
      ...filteredContent.events.map((item) => ({
        id: `event-${item.id}`,
        title: item.title,
        description: `${item.organization} · ${item.format} · ${item.dateText ?? formatDate(item.startDate)}`,
        href: item.url,
        section: 'Eventos',
        icon: CalendarDays,
        tone: 'info' as const,
      })),
      ...filteredContent.news.map((item) => ({
        id: `news-${item.id}`,
        title: item.title,
        description: item.excerpt,
        href: item.href ?? item.url ?? '#noticias',
        section: 'Noticias',
        icon: Newspaper,
        tone: item.tone,
      })),
      ...filteredContent.supportAst.map((item) => ({
        id: `support-${item.id}`,
        title: item.title,
        description: item.phone ? `${item.description} Telefono: ${item.phone}` : item.description,
        href: item.href,
        section: 'Soporte AST',
        icon: iconMap[item.icon as keyof typeof iconMap] ?? LifeBuoy,
        tone: item.tone,
      })),
    ].slice(0, 10);
  }, [filteredContent, searchQuery]);

  return (
    <div className="home-shell">
      {showHome ? (
      <section
        id="inicio"
        className="home-compact-hero scroll-mt-40"
      >
        <div className="home-hero-copy">
          <span className="home-eyebrow">Portal interno</span>
          <h1 id="home-title">El Workspace de Neovantas</h1>
          <p>
            Accede a los recursos más utilizados por bloque: asistentes IA, herramientas internas,
            documentación, repositorios, noticias y eventos.
          </p>

          <SearchBar
            value={searchValue}
            onChange={setSearchValue}
            className="home-search-box"
            placeholder="Buscar GPTs, documentos, aplicaciones o recursos..."
          />
        </div>

        <aside className="home-quick-side" aria-label="Accesos rápidos">
          <div className="home-side-title">Accesos rápidos</div>
          {homeQuickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.title} className="home-side-link" href={item.href} {...getLinkProps(item.href)}>
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.title}</span>
                </span>
                <span aria-hidden="true">↗</span>
              </a>
            );
          })}
        </aside>
      </section>
      ) : null}

      {showHome && isSearching ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-neovantas-line bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-50 text-neovantas-blue">
                <SearchX className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">
                  {totalResults === 1 ? '1 resultado encontrado' : `${totalResults} resultados encontrados`}
                </p>
                <p className="mt-1 truncate text-sm text-slate-500">Búsqueda activa: {searchValue}</p>
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
          </div>

          {searchResults.length > 0 ? (
            <div className="divide-y divide-neovantas-line">
              {searchResults.map((result) => {
                const Icon = result.icon;

                return (
                  <a
                    key={result.id}
                    href={result.href}
                    {...getLinkProps(result.href)}
                    className="focus-ring flex items-start gap-4 px-5 py-4 transition hover:bg-neovantas-mist"
                  >
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${result.tone === 'success' ? 'bg-[#EAFBF2] text-neovantas-teal' : result.tone === 'warning' ? 'bg-[#FEF3E6] text-[#985D0F]' : result.tone === 'critical' ? 'bg-[#FFF1E5] text-[#C2410C]' : 'bg-[#EEF8FF] text-neovantas-blue'}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neovantas-muted">
                        {result.section}
                      </span>
                      <h3 className="mt-1 text-sm font-semibold text-neovantas-navy">{result.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-neovantas-muted">{result.description}</p>
                    </div>
                    <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-neovantas-muted" aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          ) : null}
        </Card>
      ) : null}

      {showHome && isSearching && totalResults === 0 ? (
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

      {false ? (
      <section id="accesos" className="hidden scroll-mt-40" aria-labelledby="portal-recursos-title">
        <div className="home-blocks-header">
          <div>
            <h2 id="portal-recursos-title">Accesos rápidos</h2>
            <p>Accesos directos a las herramientas y espacios más utilizados por el equipo.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {resourceLinks.map((item) => (
            <HomeLinkCard key={item.title} item={item} compact />
          ))}
        </div>
      </section>
      ) : null}

      {showHome ? (
      <section aria-labelledby="bloques-principales-title">
        <div className="home-blocks-header">
          <div>
            <h2 id="bloques-principales-title">Bloques principales</h2>
            <p>Una vista rápida de los accesos operativos más importantes del portal.</p>
          </div>
        </div>

        <div className="home-blocks-row">
          {portalHomeBlocks.map((block) => (
            <HomeBlockCard key={block.title} block={block} />
          ))}
        </div>
      </section>
      ) : null}

      {showIa && (!isSearching || filteredContent.assistants.length > 0) ? (
        <section id="herramientas-ia" className="scroll-mt-40">
          <SectionHeader
            title="Herramientas IA"
            description="Asistentes internos, GPTs y recursos para acelerar el trabajo diario con criterio Neovantas."
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredContent.assistants.map((assistant) => (
              <Card key={assistant.id} className="p-5 transition hover:-translate-y-0.5 hover:border-neovantas-blue">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-[#EBF2FE] text-neovantas-blue">
                    <Bot className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <Badge tone={assistant.tone}>{assistant.status}</Badge>
                </div>
                <h3 className="mt-4 text-base font-semibold text-neovantas-navy">{assistant.title}</h3>
                <p className="mt-2 text-sm leading-6 text-neovantas-muted">{assistant.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {assistant.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-neovantas-mist px-2.5 py-1 text-xs text-neovantas-muted">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-neovantas-muted">{assistant.owner}</span>
                  <a
                    href={assistant.href}
                    {...getLinkProps(assistant.href)}
                    className="inline-flex items-center gap-1.5 font-semibold text-neovantas-blue"
                  >
                    Abrir
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {showHome && (!isSearching || upcomingEvents.length > 0) ? (
        <UpcomingEventsBlock events={upcomingEvents} todayIso={todayIso} />
      ) : null}

      {(showHome || showNews || showDocuments) &&
      (!isSearching || visibleNewsItems.length > 0 || visibleDocumentItems.length > 0) ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          {(showHome || showNews) && (!isSearching || visibleNewsItems.length > 0) ? (
            <div id="noticias" className="home-news-section widget scroll-mt-40">
              <div className="widget-title">
                <Newspaper className="h-4 w-4" aria-hidden="true" />
                Noticias del correo
                <a href="#noticias" className="section-action">Ver todas</a>
              </div>
              <div className="space-y-3">
                {visibleNewsItems.map((item) => (
                  <a
                    key={item.id}
                    href={item.href ?? '#'}
                    {...getLinkProps(item.href ?? '#')}
                    className="flex items-start gap-4 rounded-[14px] border border-neovantas-line bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:border-neovantas-blue"
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
            </div>
          ) : null}

          {(showHome || showDocuments) && (!isSearching || visibleDocumentItems.length > 0) ? (
            <div id="documentacion" className="home-news-section widget scroll-mt-40">
              <div className="widget-title">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Últimos documentos
                <a href="#documentacion" className="section-action">Ver todos</a>
              </div>
              <div className="space-y-3">
                {visibleDocumentItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-4 rounded-[14px] border border-neovantas-line bg-white px-4 py-4">
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
            </div>
          ) : null}
        </section>
      ) : null}

      {showEvents && (!isSearching || filteredContent.events.length > 0) ? (
        <EventsSection events={filteredContent.events} todayIso={todayIso} />
      ) : null}

      {showRepositories && (!isSearching || filteredContent.sharePointResources.length > 0) ? (
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

      {showResources && (!isSearching || filteredContent.apps.length > 0) ? (
        <section id="recursos-herramientas" className="scroll-mt-40">
          <SectionHeader
            title="Recursos y herramientas"
            description="Aplicaciones internas, gestión, productividad, diseño, formación y accesos operativos."
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

      {showSupport && (!isSearching || filteredContent.supportAst.length > 0) ? (
        <section id="soporte-ast" className="scroll-mt-40">
          <SectionHeader
            title="Soporte AST"
            description="Canales para incidencias, solicitudes de acceso, equipamiento y soporte del puesto de trabajo."
          />

          <div className="grid gap-4 md:grid-cols-[minmax(0,520px)]">
            {filteredContent.supportAst.map((item) => {
              const Icon = iconMap[item.icon as keyof typeof iconMap] ?? LifeBuoy;

              return (
                <Card key={item.id} className="p-5 transition hover:-translate-y-0.5 hover:border-neovantas-blue">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-[#E0FAF5] text-[#0A7A65]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <Badge tone={item.tone}>{item.status}</Badge>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-neovantas-navy">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-neovantas-muted">{item.description}</p>
                  {item.phone ? (
                    <p className="mt-3 text-sm font-semibold text-neovantas-navy">
                      Telefono: <a href={`tel:${item.phone}`} className="text-neovantas-blue">{item.phone}</a>
                    </p>
                  ) : null}
                  <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-neovantas-muted">{item.owner}</span>
                    <a
                      href={item.href}
                      {...getLinkProps(item.href)}
                      className="inline-flex items-center gap-1.5 font-semibold text-neovantas-blue"
                    >
                      Abrir correo
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
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
