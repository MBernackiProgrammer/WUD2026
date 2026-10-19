import { artistKey, artistUpcomingEvents, eventArtists } from './event-artists';
import { Concert } from '../models/concert.model';

describe('Artist profiles and programme credits', () => {
  it('keeps instrument continuations attached to the correct performer', () => {
    const people = eventArtists({
      artists:
        'Paulina Przybysz - wokal, Marek Pędziwiatr - fortepian, instrumenty klawiszowe, Wiktoria Jakubowska - perkusja, flet',
    });
    expect(people.length).toBe(3);
    expect(people[1].name).toBe('Marek Pędziwiatr');
    expect(people[1].role).toBe('fortepian, instrumenty klawiszowe');
    expect(people[2].role).toBe('perkusja, flet');
  });
  it('preserves a structured identity and biography without duplicating legacy credits', () => {
    const people = eventArtists({
      artists: 'Paweł Maślanka - skrzypce',
      details: { performers: [{ id: 'artist-1', name: 'Paweł Maślanka', biography: 'Biogram' }] },
    });
    expect(people.length).toBe(1);
    expect(people[0].id).toBe('artist-1');
    expect(people[0].biography).toBe('Biogram');
  });
  it('matches exact identities across structured and legacy events, excludes past starts, sorts chronologically', () => {
    const event = (
      id: string,
      date: string,
      time: string,
      artists: string,
      details?: Concert['details'],
    ) => ({ id, date, time, artists, details }) as Concert;
    const events = [
      event('later', '2026-10-20', '19:00', 'Anna Nowak - flet'),
      event('past', '2026-10-18', '08:00', 'Anna Nowak - flet'),
      event('other', '2026-10-19', '19:00', 'Joanna Nowak - flet'),
      event('next', '2026-10-18', '11:00', '', {
        performers: [{ id: 'structured-7', name: 'Anna Nowak' }],
      }),
    ];
    expect(
      artistUpcomingEvents(
        events,
        { id: 'nazwa-anna-nowak', name: 'Anna Nowak' },
        new Date('2026-10-18T07:00:00Z'),
      ).map((e) => e.id),
    ).toEqual(['next', 'later']);
  });
  it('generates stable links independently of Polish characters and letter case', () => {
    expect(artistKey(' Paweł Maślanka ')).toBe(artistKey('PAWEL MASLANKA'));
  });
});
