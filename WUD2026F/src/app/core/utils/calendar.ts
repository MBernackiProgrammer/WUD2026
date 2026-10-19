import { Concert } from '../models/concert.model';

export function createCalendarEntry(event: Concert, timestamp = new Date()): string {
  const start = event.date.replace(/-/g, '') + 'T' + event.time.replace(':', '') + '00';
  const created = timestamp
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Filharmonia Demo//PL',
    'BEGIN:VEVENT',
    `UID:${event.id}@demo.filharmonia.local`,
    `DTSTAMP:${created}`,
    // TZID keeps the advertised local time through daylight-saving changes.
    `DTSTART;TZID=Europe/Warsaw:${start}`,
    ...(event.duration !== null ? [`DURATION:PT${event.duration}M`] : []),
    `SUMMARY:[DEMO] ${event.title}`,
    `LOCATION:${event.room} - Małopolska 48 Szczecin`,
    'DESCRIPTION:Wydarzenie demonstracyjne. Nie jest to potwierdzona rezerwacja.',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
