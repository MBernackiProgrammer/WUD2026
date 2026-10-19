import { Concert } from '../models/concert.model';

/** Preserve explicit workshop age bands from the organizer, rather than treating them as minimum ages. */
export function matchesChildAge(event: Concert, age: number): boolean {
  if (
    !['Rodziny', 'Dzieci', 'Młodzież', 'Szkoły'].includes(event.audience) ||
    age < event.age ||
    (event.details?.ageMax != null && age > event.details.ageMax)
  )
    return false;
  const range = event.subtitle.match(/od\s+(\d+)[.\s]*do\s+(\d+)/i);
  return !range || (age >= Number(range[1]) && age <= Number(range[2]));
}
