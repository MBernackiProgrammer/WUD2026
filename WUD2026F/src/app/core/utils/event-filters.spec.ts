import { CONCERTS } from '../data/demo-concerts';
import { createCalendarEntry } from './calendar';
import { filterConcerts, matchesDate } from './event-filters';
import { recommendConcerts } from './recommendations';

const defaultFilters = {
  query: '',
  category: '',
  period: '',
  budget: '',
  age: '',
  availableOnly: false,
};

describe('Concert discovery rules', () => {
  it('keeps non-concert tags out of the music quiz even when their category matches a music preference', () => {
    const activity = { ...CONCERTS[0], id: 'activity', category: 'Jazz', tags: ['events'] };
    const music = { ...CONCERTS[0], id: 'music', tags: ['repertoire'] };
    expect(
      recommendConcerts(
        [activity, music],
        ['', 'Dowolny termin', 'Jazz', '', 'Bez ograniczeń'],
        5,
      ).map((event) => event.id),
    ).toEqual(['music']);
  });
  it('respects the upper age limit of workshops from the official programme', () => {
    const workshop = {
      ...CONCERTS[0],
      audience: 'Rodziny',
      age: 1,
      subtitle: 'Warsztaty dla dzieci od 1. do 2. roku życia z opiekunami',
    };
    expect(filterConcerts([workshop], { ...defaultFilters, age: '2' })).toEqual([workshop]);
    expect(filterConcerts([workshop], { ...defaultFilters, age: '5' })).toEqual([]);
  });
  it('does not classify unknown prices as free or within a fixed budget', () => {
    const unknown = { ...CONCERTS[0], price: null, duration: null };
    expect(filterConcerts([unknown], { ...defaultFilters, budget: '0' })).toEqual([]);
    expect(filterConcerts([unknown], { ...defaultFilters, budget: '80' })).toEqual([]);
    expect(filterConcerts([unknown], defaultFilters)).toEqual([unknown]);
    expect(createCalendarEntry(unknown)).not.toContain('DURATION:');
  });
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-23T12:00:00Z'));
  });
  afterEach(() => jasmine.clock().uninstall());

  it('combines family age, budget and availability without mutating the source', () => {
    const originalOrder = CONCERTS.map((event) => event.id);
    const results = filterConcerts(CONCERTS, {
      ...defaultFilters,
      age: '5',
      budget: '30',
      availableOnly: true,
    });
    expect(results.map((event) => event.id)).toEqual(['male-wielkie-dzwieki']);
    expect(CONCERTS.map((event) => event.id)).toEqual(originalOrder);
  });

  it('includes Saturday in this weekend and excludes the preceding Friday', () => {
    expect(
      matchesDate(
        CONCERTS.find((event) => event.id === 'male-wielkie-dzwieki')!,
        'weekend',
      ),
    ).toBeTrue();
    expect(
      matchesDate(
        CONCERTS.find((event) => event.id === 'wieczor-z-beethovenem')!,
        'weekend',
      ),
    ).toBeFalse();
  });

  it('filters an explicit month including past events without leaking adjacent years', () => {
    const event = CONCERTS[0];
    expect(matchesDate({ ...event, date: '2025-12-01' }, '2025-12')).toBeTrue();
    expect(matchesDate({ ...event, date: '2026-12-01' }, '2025-12')).toBeFalse();
    expect(matchesDate({ ...event, date: '2026-01-01' }, '2025-12')).toBeFalse();
  });

  it('keeps past and upcoming events in ascending date and time order in a selected month', () => {
    const event = CONCERTS[0];
    const events = [
      { ...event, id: 'late', date: '2026-10-24', time: '20:00' },
      { ...event, id: 'past', date: '2026-10-01', time: '19:00' },
      { ...event, id: 'early', date: '2026-10-24', time: '18:00' },
    ];
    expect(
      filterConcerts(events, { ...defaultFilters, period: '2026-10' }).map((item) => item.id),
    ).toEqual(['past', 'early', 'late']);
    expect(events[0].id).toBe('late');
  });

  it('searches text without Polish diacritics', () => {
    const results = filterConcerts(CONCERTS, { ...defaultFilters, query: 'male wielkie dzwieki' });
    expect(results.map((event) => event.id)).toEqual(['male-wielkie-dzwieki']);
  });

  it('exports a calendar entry using Warsaw local time and demo labelling', () => {
    const event = CONCERTS.find((event) => event.id === 'wieczor-z-beethovenem')!;
    const entry = createCalendarEntry(event, new Date('2026-10-17T12:00:00Z'));
    expect(entry).toContain('DTSTART;TZID=Europe/Warsaw:20261023T190000\r\n');
    expect(entry).toContain('SUMMARY:[DEMO] Wieczór z Beethovenem\r\n');
    expect(entry).toContain('DURATION:PT110M\r\n');
  });
  it('combines editorial filters and includes last tickets as available', () => {
    const event = {
      ...CONCERTS[0],
      date: '2026-10-24',
      status: 'last-tickets' as const,
      price: 50,
      duration: 75,
      details: {
        type: 'festival' as const,
        priceMax: 100,
        accessibility: ['mobility'],
        collection: { name: 'Jesień' },
        performers: [{ id: 'anna', name: 'Anna Żak' }],
        works: [{ title: 'Koncert', composer: 'Chopin' }],
      },
    };
    expect(
      filterConcerts([event], {
        ...defaultFilters,
        period: '2026-10',
        availableOnly: true,
        type: 'festival',
        accessibility: 'mobility',
        performer: 'anna zak',
        composer: 'chopin',
        cycle: 'jesien',
        priceMin: '80',
        budget: '60',
        duration: '90',
      }),
    ).toEqual([event]);
    expect(
      filterConcerts([event], { ...defaultFilters, period: '2026-10', accessibility: 'hearing' }),
    ).toEqual([]);
  });
  it('keeps an exhibition spanning months and filters past custom ranges', () => {
    const event = { ...CONCERTS[0], date: '2026-09-20', details: { endDate: '2026-10-05' } };
    expect(filterConcerts([event], { ...defaultFilters, period: '2026-10' })).toEqual([event]);
    expect(
      filterConcerts([event], {
        ...defaultFilters,
        period: 'range',
        from: '2026-09-25',
        to: '2026-10-01',
      }),
    ).toEqual([event]);
    expect(
      filterConcerts([event], { ...defaultFilters, period: 'range', from: '2026-10-06' }),
    ).toEqual([]);
  });
  it('supports tomorrow and this week across month boundaries', () => {
    jasmine.clock().mockDate(new Date('2026-10-31T12:00:00Z'));
    const event = { ...CONCERTS[0], date: '2026-11-01' };
    expect(matchesDate(event, 'tomorrow')).toBeTrue();
    expect(matchesDate(event, 'week')).toBeTrue();
    expect(matchesDate({ ...event, date: '2026-11-02' }, 'week')).toBeFalse();
  });
  it('includes an ongoing exhibition in today and weekend filters', () => {
    const event = { ...CONCERTS[0], date: '2026-10-01', details: { endDate: '2026-10-30' } };
    expect(matchesDate(event, 'today')).toBeTrue();
    expect(matchesDate(event, 'weekend')).toBeTrue();
  });
});
