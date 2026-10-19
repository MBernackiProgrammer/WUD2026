import { Concert } from '../models/concert.model';

const WARSAW_TIME = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Event dates and start times in the catalogue are local to Szczecin. */
export function isPastEvent(
  event: Pick<Concert, 'date' | 'time'> & Partial<Pick<Concert, 'details'>>,
  now = new Date(),
): boolean {
  const parts = Object.fromEntries(
    WARSAW_TIME.formatToParts(now).map((part) => [part.type, part.value]),
  );
  const localNow = `${parts['year']}-${parts['month']}-${parts['day']}T${parts['hour']}:${parts['minute']}:${parts['second']}`;
  return (
    `${event.details?.endDate ?? event.date}T${event.details?.endDate ? '23:59' : event.time}:00` <=
    localNow
  );
}
