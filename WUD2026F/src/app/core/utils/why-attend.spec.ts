import { whyAttend } from './why-attend';
import { Concert } from '../models/concert.model';

describe('Short event recommendation', () => {
  const event = {
    title: 'Wieczór muzyczny',
    category: 'Jazz',
    audience: 'Dorośli',
    artists: 'Anna Nowak - fortepian',
    program: [],
  } as unknown as Concert;
  const count = (text: string) =>
    Array.from(new Intl.Segmenter('pl', { granularity: 'sentence' }).segment(text)).length;
  it('always provides three contextual sentences without editorial copy', () => {
    for (const category of [
      'Jazz',
      'Dla rodzin',
      'Symfoniczne',
      'Kameralne',
      'Recitale',
      'Wystawy',
      'Zwiedzanie',
      'Inne',
    ]) {
      const text = whyAttend({ ...event, category });
      expect(count(text)).toBe(3);
      expect(text).toContain('Wieczór muzyczny');
    }
  });
  it('uses only announced performers and programme facts', () => {
    expect(whyAttend(event)).toContain('Anna Nowak');
    const text = whyAttend({ ...event, program: ['V Symfonia'] });
    expect(text).toContain('V Symfonia');
    expect(text).not.toContain('Beethoven');
  });
  it('keeps curated copy, adds missing sentences and limits long copy to four', () => {
    expect(whyAttend({ ...event, details: { whyAttend: 'Osobiste spotkanie z jazzem' } })).toMatch(
      /^Osobiste spotkanie z jazzem\./,
    );
    expect(
      count(whyAttend({ ...event, details: { whyAttend: 'Osobiste spotkanie z jazzem' } })),
    ).toBe(3);
    const curated = 'Pierwsze zdanie. Drugie zdanie. Trzecie zdanie.';
    expect(whyAttend({ ...event, details: { whyAttend: curated } })).toBe(curated);
    expect(
      count(
        whyAttend({ ...event, details: { whyAttend: curated + ' Czwarte zdanie. Piąte zdanie.' } }),
      ),
    ).toBe(4);
  });
  it('does not promise children content for adult educational events', () => {
    expect(whyAttend({ ...event, details: { type: 'education' } })).not.toContain('dzieci');
  });
});
