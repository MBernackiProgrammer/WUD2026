import { searchEvents, textSearchScore } from './content-search';
import { Concert } from '../models/concert.model';
const now = new Date('2026-10-18T08:00:00Z');
function event(id: string, date: string, category = 'Jazz', extra: Partial<Concert> = {}): Concert {
  return {
    id,
    date,
    time: '19:00',
    title: 'Wieczór muzyki',
    subtitle: '',
    category,
    tags: [],
    duration: 60,
    room: 'Sala',
    price: 40,
    image: '',
    mood: '',
    audience: 'Dorośli',
    age: 0,
    description: '',
    program: [],
    artists: '',
    status: 'available',
    ...extra,
  };
}
describe('Intent content search', () => {
  it('recognizes named months, inflections and spelling mistakes as date filters', () => {
    const events = [
      event('past-oct', '2026-10-01'),
      event('oct', '2026-10-25'),
      event('nov', '2026-11-02'),
      event('future-oct', '2027-10-20'),
    ];
    for (const query of [
      'październik',
      'pazdzernik',
      'październk',
      'w październiku',
      'szukam koncertów w pażdzierniku',
    ]) {
      expect(searchEvents(events, query, false, now).map((e) => e.id)).toEqual([
        'oct',
        'future-oct',
      ]);
    }
    expect(searchEvents(events, 'październik 2026', false, now).map((e) => e.id)).toEqual(['oct']);
    expect(searchEvents(events, 'październik 2026', true, now).map((e) => e.id)).toEqual([
      'oct',
      'past-oct',
    ]);
  });
  it('combines month intent with genre and does not turn unrelated words into months', () => {
    expect(
      searchEvents(
        [
          event('jazz', '2026-10-22'),
          event('other', '2026-10-23', 'Kameralne'),
          event('nov', '2026-11-01'),
        ],
        'jazz w pazdzerniku',
        false,
        now,
      ).map((e) => e.id),
    ).toEqual(['jazz']);
    expect(textSearchScore('Fortepian', 'Fortepian')).toBeGreaterThan(0);
    expect(searchEvents([event('oct', '2026-10-22')], 'majster', false, now)).toEqual([]);
  });
  it('understands jazz inflections and orders upcoming dates first', () => {
    const events = [
      event('late', '2026-11-10'),
      event('past', '2026-10-01'),
      event('next', '2026-10-19'),
      event('other', '2026-10-20', 'Kameralne'),
    ];
    expect(
      searchEvents(events, 'szukam najbliższych koncertów jazzowych', false, now).map((e) => e.id),
    ).toEqual(['next', 'late']);
    expect(searchEvents(events, 'jazz', true, now).map((e) => e.id)).toEqual([
      'next',
      'late',
      'past',
    ]);
  });
  it('requires all meaningful concepts and tolerates a simple misspelling', () => {
    expect(textSearchScore('Koncert jazzowy', 'jazz klasyka')).toBe(0);
    expect(textSearchScore('Chopin', 'Chpo in')).toBe(0);
    expect(textSearchScore('Chopin', 'Chopni')).toBeGreaterThan(0);
  });
  it('matches family age and free admission without unknown prices', () => {
    const events = [
      event('yes', '2026-10-20', 'Dla rodzin', {
        audience: 'Rodziny',
        age: 5,
        price: 0,
        details: { ageMax: 8 },
      }),
      event('older', '2026-10-20', 'Dla rodzin', { audience: 'Rodziny', age: 10, price: 0 }),
      event('unknown', '2026-10-20', 'Dla rodzin', { audience: 'Rodziny', age: 5, price: null }),
    ];
    expect(
      searchEvents(events, 'dla dziecka 6 lat bezpłatnie', false, now).map((e) => e.id),
    ).toEqual(['yes']);
  });
  it('finds composers in structured programme data', () => {
    expect(
      searchEvents(
        [
          event('piano', '2026-10-20', 'Kameralne', {
            details: { works: [{ title: 'Koncert', composer: 'Fryderyk Chopin' }] },
          }),
        ],
        'Chopin',
        false,
        now,
      ).map((e) => e.id),
    ).toEqual(['piano']);
  });
});
