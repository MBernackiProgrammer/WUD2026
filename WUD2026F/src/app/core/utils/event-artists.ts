import { Artist } from '../models/event-details.model';
import { Concert } from '../models/concert.model';
import { isPastEvent } from './event-time';

export function artistKey(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Legacy catalogue entries contain one comma-separated credits string. Lowercase
 * instrument continuations (e.g. fortepian, instrumenty klawiszowe) stay together. */
export function eventArtists(event: Pick<Concert, 'artists' | 'details'>): Artist[] {
  const result: Artist[] = [...(event.details?.performers ?? [])];
  for (const line of (event.artists || '').split(/[,;\n]\s*(?=[A-ZĄĆĘŁŃÓŚŹŻ])/u)) {
    const [rawName, ...roles] = line.trim().split(/\s+[-–—]\s+/u);
    const name = rawName?.trim();
    if (!name || result.some((p) => artistKey(p.name) === artistKey(name))) continue;
    result.push({ id: 'nazwa-' + artistKey(name), name, role: roles.join(' — ') || undefined });
  }
  return result;
}

export function artistUpcomingEvents(events: Concert[], artist: Artist, now: Date): Concert[] {
  return events
    .filter(
      (e) =>
        !isPastEvent(e, now) &&
        eventArtists(e).some(
          (p) => p.id === artist.id || artistKey(p.name) === artistKey(artist.name),
        ),
    )
    .sort((a, b) => (a.date + 'T' + a.time).localeCompare(b.date + 'T' + b.time));
}
