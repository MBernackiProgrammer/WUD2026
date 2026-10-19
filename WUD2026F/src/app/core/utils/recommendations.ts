import { Concert } from '../models/concert.model';
import { matchesChildAge } from './event-audience';
import { matchesDate } from './event-filters';
import { catalogSection } from './catalog-section';

const DATE_PREFERENCES: Record<string, string> = {
  Dzisiaj: 'today',
  'Ten weekend': 'weekend',
  'W tym miesiącu': 'month',
};
const BUDGET_LIMITS: Record<string, number> = {
  Bezpłatnie: 0,
  'Do 30 zł': 30,
  'Do 50 zł': 50,
};
const MUSIC_PREFERENCES: Record<string, string> = {
  'Muzyka symfoniczna': 'Symfoniczne',
  Jazz: 'Jazz',
  'Muzyka filmowa': 'Filmowe',
  'Muzyka kameralna': 'Kameralne',
};
const MOOD_PREFERENCES: Record<string, string> = {
  Energii: 'Energia',
  Relaksu: 'Relaks',
  Wzruszeń: 'Wzruszenie',
  'Nowych odkryć': 'Odkrywanie',
};

export function recommendConcerts(
  events: Concert[],
  answers: string[],
  childAge: number,
): Concert[] {
  const [audience, date, music, mood, budget] = answers;
  const datePreference = DATE_PREFERENCES[date] ?? '';

  return events
    .filter((event) => {
      const matchesAudience = audience !== 'Z dzieckiem' || matchesChildAge(event, childAge);
      const matchesBudget =
        !(budget in BUDGET_LIMITS) ||
        (event.price !== null && event.price <= BUDGET_LIMITS[budget]);
      return (
        catalogSection(event) === 'repertoire' &&
        event.status !== 'sold-out' &&
        matchesDate(event, datePreference) &&
        matchesAudience &&
        matchesBudget
      );
    })
    .map((event) => ({
      event,
      score:
        (MUSIC_PREFERENCES[music] === event.category ? 20 : 0) +
        (MOOD_PREFERENCES[mood] === event.mood ? 15 : 0) +
        (event.category !== 'Zwiedzanie' ? 5 : 0),
    }))
    .sort(
      (first, second) =>
        second.score - first.score || first.event.date.localeCompare(second.event.date),
    )
    .slice(0, 3)
    .map((result) => result.event);
}

export function getRecommendationReason(answers: string[]): string {
  const [audience, date, , , budget] = answers;
  return [
    audience === 'Z dzieckiem' ? 'Uwzględniliśmy wiek dziecka.' : '',
    date && date !== 'Dowolny termin' ? 'Uwzględniliśmy wybrany termin.' : '',
    budget && budget !== 'Bez ograniczeń' ? 'Ceny mieszczą się w Twoim budżecie.' : '',
  ]
    .filter(Boolean)
    .join(' ');
}
