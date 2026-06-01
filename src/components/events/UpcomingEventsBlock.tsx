import type { EventItem } from '../../types/content';
import { isPastEvent, sortEventsAscending } from '../../lib/events';
import { Card } from '../ui/Card';
import { EventCard } from './EventCard';
import { SectionHeader } from '../ui/SectionHeader';

type UpcomingEventsBlockProps = {
  events: EventItem[];
  todayIso?: string;
};

export function UpcomingEventsBlock({ events, todayIso }: UpcomingEventsBlockProps) {
  const upcomingEvents = [...events]
    .filter((event) => !isPastEvent(event, todayIso))
    .sort(sortEventsAscending)
    .slice(0, 3);

  return (
    <section className="scroll-mt-40">
      <SectionHeader
        title="Proximos eventos"
        description="Eventos futuros y de hoy procedentes del calendario corporativo."
      />

      {upcomingEvents.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {upcomingEvents.map((event) => (
            <EventCard key={event.id} event={event} compact todayIso={todayIso} />
          ))}
        </div>
      ) : (
        <Card className="p-6 text-sm text-neovantas-muted">
          No hay eventos proximos publicados todavia.
        </Card>
      )}
    </section>
  );
}
