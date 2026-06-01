import type { EventItem } from '../types/content';

const DEFAULT_TIME_ZONE = 'Europe/Madrid';

export type EventTimelineState = 'today' | 'upcoming' | 'past';

export function getTodayIso(timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function classifyEvent(event: Pick<EventItem, 'startDate' | 'endDate' | 'timezone'>, todayIso = getTodayIso(event.timezone || DEFAULT_TIME_ZONE)) {
  const startDate = event.startDate.slice(0, 10);
  const endDate = event.endDate.slice(0, 10);

  if (todayIso < startDate) {
    return 'upcoming';
  }

  if (todayIso > endDate) {
    return 'past';
  }

  return 'today';
}

export function isUpcomingEvent(event: Pick<EventItem, 'startDate' | 'endDate' | 'timezone'>, todayIso = getTodayIso(event.timezone || DEFAULT_TIME_ZONE)) {
  return classifyEvent(event, todayIso) !== 'past';
}

export function isPastEvent(event: Pick<EventItem, 'startDate' | 'endDate' | 'timezone'>, todayIso = getTodayIso(event.timezone || DEFAULT_TIME_ZONE)) {
  return classifyEvent(event, todayIso) === 'past';
}

export function sortEventsAscending(left: Pick<EventItem, 'startDate' | 'endDate' | 'title'>, right: Pick<EventItem, 'startDate' | 'endDate' | 'title'>) {
  return (
    left.startDate.slice(0, 10).localeCompare(right.startDate.slice(0, 10)) ||
    left.endDate.slice(0, 10).localeCompare(right.endDate.slice(0, 10)) ||
    left.title.localeCompare(right.title, 'es', { sensitivity: 'base' })
  );
}

