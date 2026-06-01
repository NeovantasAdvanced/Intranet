import { CalendarDays, Clock3, ExternalLink, Globe2, MonitorSmartphone, MoveRight, Tag } from 'lucide-react';
import type { EventItem } from '../../types/content';
import { Card } from '../ui/Card';
import { EventStatusBadge } from './EventStatusBadge';
import { classifyEvent } from '../../lib/events';

type EventCardProps = {
  event: EventItem;
  compact?: boolean;
  todayIso?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) {
    return formatDate(startDate);
  }

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function scheduleTone(workSchedule: EventItem['workSchedule']) {
  return workSchedule === 'laboral'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';
}

function scheduleLabel(workSchedule: EventItem['workSchedule']) {
  return workSchedule === 'laboral' ? 'Laboral' : 'Fuera horario';
}

export function EventCard({ event, compact = false, todayIso }: EventCardProps) {
  const state = classifyEvent(event, todayIso);

  return (
    <Card
      className={`overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-neovantas-line ${
        compact ? '' : 'h-full'
      }`}
    >
      <div className="border-b border-neovantas-line bg-neovantas-mist px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <EventStatusBadge state={state} />
          <span className="text-xs font-medium text-neovantas-muted">{event.category}</span>
          <span className="text-xs text-neovantas-muted">{event.organization}</span>
        </div>
        <h3 className={`mt-2 font-semibold text-neovantas-navy ${compact ? 'text-sm' : 'text-base'}`}>
          {event.title}
        </h3>
      </div>

      <div className={compact ? 'px-5 py-4' : 'px-5 py-5'}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neovantas-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neovantas-mist px-2.5 py-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {formatDateRange(event.startDate, event.endDate)}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${scheduleTone(event.workSchedule)}`}>
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {scheduleLabel(event.workSchedule)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF8FF] px-2.5 py-1 text-neovantas-blue">
            <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
            {event.timezone}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-neovantas-muted">
            <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden="true" />
            {event.format}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {event.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full bg-neovantas-mist px-2.5 py-1 text-xs text-neovantas-muted"
            >
              <Tag className="h-3 w-3" aria-hidden="true" />
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 border-t border-neovantas-line pt-4 text-sm">
          <p className="min-w-0 text-xs text-neovantas-muted">
            Fuente: {event.source}
          </p>
          <a
            href={event.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-neovantas-blue px-3 py-2 font-semibold text-white"
          >
            {event.cta}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <MoveRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </Card>
  );
}
