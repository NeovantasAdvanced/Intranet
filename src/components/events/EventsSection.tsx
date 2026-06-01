import { useMemo, useState } from 'react';
import type { EventItem } from '../../types/content';
import { getTodayIso, isPastEvent, sortEventsAscending } from '../../lib/events';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { EventCard } from './EventCard';

type EventsSectionProps = {
  events: EventItem[];
  todayIso?: string;
};

type EventsTab = 'upcoming' | 'past';

export function EventsSection({ events, todayIso: providedTodayIso }: EventsSectionProps) {
  const todayIso = providedTodayIso ?? getTodayIso();
  const [activeTab, setActiveTab] = useState<EventsTab>('upcoming');

  const sortedEvents = useMemo(() => [...events].sort(sortEventsAscending), [events]);

  const upcomingEvents = sortedEvents.filter((event) => !isPastEvent(event, todayIso));
  const pastEvents = sortedEvents.filter((event) => isPastEvent(event, todayIso));
  const activeEvents = activeTab === 'upcoming' ? upcomingEvents : pastEvents;

  return (
    <section id="eventos" className="scroll-mt-40">
      <SectionHeader
        title="Eventos"
        description="Agenda preparada para importar automaticamente desde Outlook."
        action={
          <div className="inline-flex rounded-full border border-neovantas-line bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveTab('upcoming')}
              className={`focus-ring rounded-full px-4 py-1.5 text-sm font-semibold ${
                activeTab === 'upcoming'
                  ? 'bg-neovantas-navy text-white'
                  : 'text-neovantas-muted hover:text-neovantas-navy'
              }`}
            >
              Proximos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('past')}
              className={`focus-ring rounded-full px-4 py-1.5 text-sm font-semibold ${
                activeTab === 'past'
                  ? 'bg-neovantas-navy text-white'
                  : 'text-neovantas-muted hover:text-neovantas-navy'
              }`}
            >
              Pasados
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {activeEvents.length > 0 ? (
          activeEvents.map((event) => (
            <EventCard key={event.id} event={event} todayIso={todayIso} />
          ))
        ) : (
          <Card className="p-6 text-sm text-neovantas-muted lg:col-span-2">
            No hay eventos en esta vista.
          </Card>
        )}
      </div>
    </section>
  );
}
