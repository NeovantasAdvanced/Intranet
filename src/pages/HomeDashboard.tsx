import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Database,
  FileText,
  LifeBuoy,
  Newspaper,
  Rocket,
  Sparkles,
  Users,
} from 'lucide-react';
import quickLinksData from '../data/quickLinks.json';
import assistantsData from '../data/assistants.json';
import newsData from '../data/news.json';
import documentsData from '../data/documents.json';
import appsData from '../data/apps.json';
import roadmapData from '../data/roadmap.json';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import type {
  Assistant,
  DocumentItem,
  InternalApp,
  NewsItem,
  QuickLink,
  RoadmapItem,
} from '../types/content';

const quickLinks = quickLinksData as QuickLink[];
const assistants = assistantsData as Assistant[];
const news = newsData as NewsItem[];
const documents = documentsData as DocumentItem[];
const apps = appsData as InternalApp[];
const roadmap = roadmapData as RoadmapItem[];

const iconMap = {
  users: Users,
  'life-buoy': LifeBuoy,
  calendar: CalendarDays,
  rocket: Rocket,
  briefcase: BriefcaseBusiness,
  clock: Clock3,
  database: Database,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function HomeDashboard() {
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
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-2xl font-semibold text-slate-950">{quickLinks.length}</p>
              <p className="mt-1 text-xs text-slate-500">Accesos</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-2xl font-semibold text-slate-950">{assistants.length}</p>
              <p className="mt-1 text-xs text-slate-500">GPTs</p>
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

      <section>
        <SectionHeader
          title="Accesos rapidos"
          description="Atajos operativos para las tareas mas frecuentes."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((item) => {
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

      <section id="mesa-ia" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
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
            {assistants.map((assistant) => (
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
            {roadmap.map((item) => (
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
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div>
          <SectionHeader title="Noticias" description="Comunicaciones relevantes para el equipo." />
          <div className="space-y-3">
            {news.map((item) => (
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

        <div>
          <SectionHeader title="Documentacion" description="Recursos versionados y listos para enlazar." />
          <div className="space-y-3">
            {documents.map((item) => (
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
      </section>

      <section>
        <SectionHeader title="Aplicaciones internas" description="Servicios conectables en proximas iteraciones." />
        <div className="grid gap-4 md:grid-cols-3">
          {apps.map((app) => {
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
    </div>
  );
}
