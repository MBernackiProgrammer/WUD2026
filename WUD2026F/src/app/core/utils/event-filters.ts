import { Concert } from '../models/concert.model';
import { matchesChildAge } from './event-audience';

const WARSAW_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function normalize(text: string): string {
  return text
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
}

export function matchesDate(event: Concert, period: string): boolean {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
    return (
      event.date.slice(0, 7) <= period &&
      (event.details?.endDate ?? event.date).slice(0, 7) >= period
    );
  const today = WARSAW_DATE_FORMAT.format(new Date());
  if (period === 'range') return true;
  if ((event.details?.endDate ?? event.date) < today) return false;

  switch (period) {
    case 'tomorrow':
      return (
        event.date <= shiftDate(today, 1) &&
        (event.details?.endDate ?? event.date) >= shiftDate(today, 1)
      );
    case 'week':
      return event.date <= shiftDate(today, (7 - new Date(today + 'T12:00:00Z').getUTCDay()) % 7);
    case 'today':
      return event.date <= today && (event.details?.endDate ?? event.date) >= today;
    case 'month':
      return (
        event.date.slice(0, 7) <= today.slice(0, 7) &&
        (event.details?.endDate ?? event.date).slice(0, 7) >= today.slice(0, 7)
      );
    case 'weekend':
      return isInCurrentWeekend(event.date, today, event.details?.endDate);
    default:
      return true;
  }
}

function isInCurrentWeekend(eventDate: string, today: string, endDate?: string | null): boolean {
  const day = new Date(today + 'T12:00:00Z').getUTCDay();
  const sunday = shiftDate(today, (7 - day) % 7);
  const start = day === 0 ? today : shiftDate(sunday, -1);
  return eventDate <= sunday && (endDate ?? eventDate) >= start;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(date + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export interface RepertoireFilters {
  from?: string;
  to?: string;
  audience?: string;
  mood?: string;
  room?: string;
  priceMin?: string;
  duration?: string;
  durationMin?: string;
  durationMax?: string;
  accessibility?: string;
  performer?: string;
  composer?: string;
  cycle?: string;
  tag?: string;
  type?: string;
  status?: string;

  query: string;
  category: string;
  period: string;
  budget: string;
  age: string;
  availableOnly: boolean;
}

export function filterConcerts(events: Concert[], filters: RepertoireFilters): Concert[] {
  const query = normalize(filters.query);
  return events
    .filter((event) => {
      const searchableText = normalize(
        [
          event.title,
          event.category,
          event.room,
          event.description,
          event.mood,
          event.artists,
          ...event.program,
          ...(event.tags ?? []),
          event.audience,
          event.details?.collection?.name ?? '',
          ...(event.details?.performers ?? []).map((p) => p.name),
          ...(event.details?.works ?? []).map((w) => w.composer + ' ' + w.title),
        ].join(' '),
      );
      const matchesQuery = !query || searchableText.includes(query);
      const matchesCategory = !filters.category || event.category === filters.category;
      const matchesBudget =
        filters.budget === '' || (event.price !== null && event.price <= Number(filters.budget));
      const matchesAge =
        filters.age === '' ||
        (matchesChildAge(event, Number(filters.age)) &&
          (event.details?.ageMax == null || +filters.age <= event.details.ageMax));
      const matchesAvailability =
        !filters.availableOnly || ['available', 'last-tickets'].includes(event.status);

      return (
        (!filters.from || (event.details?.endDate ?? event.date) >= filters.from) &&
        (!filters.to || event.date <= filters.to) &&
        (!filters.audience ||
          normalize(
            event.audience +
              ' ' +
              (event.tags ?? []).join(' ') +
              (event.audience === 'Rodziny' ? ' dzieci' : ''),
          ).includes(normalize(filters.audience))) &&
        (!filters.mood || normalize(event.mood).includes(normalize(filters.mood))) &&
        (!filters.room || normalize(event.room).includes(normalize(filters.room))) &&
        (!filters.type || event.details?.type === filters.type) &&
        (!filters.tag ||
          (event.tags ?? []).some((t) => normalize(t) === normalize(filters.tag!))) &&
        (!filters.status || event.status === filters.status) &&
        (!filters.accessibility || event.details?.accessibility?.includes(filters.accessibility)) &&
        (!filters.performer ||
          normalize(
            event.artists + ' ' + (event.details?.performers ?? []).map((p) => p.name).join(' '),
          ).includes(normalize(filters.performer))) &&
        (!filters.composer ||
          normalize(
            event.program.join(' ') +
              ' ' +
              (event.details?.works ?? []).map((w) => w.composer).join(' '),
          ).includes(normalize(filters.composer))) &&
        (!filters.cycle ||
          normalize(event.details?.collection?.name ?? '').includes(normalize(filters.cycle))) &&
        (!filters.priceMin ||
          (event.price !== null &&
            (event.details?.priceMax ?? event.price) >= +filters.priceMin)) &&
        (!filters.duration ||
          (event.duration !== null &&
            (filters.duration === '45'
              ? event.duration <= 45
              : filters.duration === '90'
                ? event.duration <= 90
                : filters.duration === 'long'
                  ? event.duration > 90
                  : true))) &&
        (!filters.durationMin ||
          (event.duration !== null && event.duration >= +filters.durationMin)) &&
        (!filters.durationMax ||
          (event.duration !== null && event.duration <= +filters.durationMax)) &&
        matchesQuery &&
        matchesCategory &&
        matchesDate(event, filters.period) &&
        matchesBudget &&
        matchesAge &&
        matchesAvailability
      );
    })
    .sort((first, second) => (first.date + first.time).localeCompare(second.date + second.time));
}
