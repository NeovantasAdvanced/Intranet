import { Badge } from '../ui/Badge';
import type { EventTimelineState } from '../../lib/events';

type EventStatusBadgeProps = {
  state: EventTimelineState;
};

const badgeCopy: Record<EventTimelineState, { tone: 'success' | 'warning' | 'info' | 'neutral'; label: string }> = {
  today: { tone: 'success', label: 'Hoy' },
  upcoming: { tone: 'info', label: 'Proximo' },
  past: { tone: 'neutral', label: 'Pasado' },
};

export function EventStatusBadge({ state }: EventStatusBadgeProps) {
  const config = badgeCopy[state];

  return <Badge tone={config.tone}>{config.label}</Badge>;
}
