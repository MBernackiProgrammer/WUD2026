import { Concert } from '../models/concert.model';

export type CatalogSection = 'repertoire' | 'events';

export function catalogSection(event: Concert): CatalogSection {
  return event.tags?.includes('events') ? 'events' : 'repertoire';
}
