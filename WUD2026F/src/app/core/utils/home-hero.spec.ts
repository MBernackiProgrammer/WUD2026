import { DEFAULT_HERO } from '../data/default-hero';
import { homeHeroContent } from './home-hero';
describe('Home hero editorial compatibility', () => {
  it('replaces the original starter headline without changing the poster', () => {
    const result = homeHeroContent({
      ...DEFAULT_HERO,
      title: 'Poczuj więcej.',
      highlightedTitle: 'Usłysz na żywo.',
      imageUrl: '/custom-poster.jpg',
    });
    expect(result.title).toBe('Filharmonia Szczecińska');
    expect(result.highlightedTitle).toBe('Zaprasza.');
    expect(result.imageUrl).toBe('/custom-poster.jpg');
  });
  it('preserves custom CMS copy and links', () => {
    const custom = {
      ...DEFAULT_HERO,
      title: 'Nowy sezon',
      highlightedTitle: 'Spotkajmy się',
      description: 'Tekst redakcji',
      primaryLabel: 'Zobacz sezon',
      primaryHref: '/kalendarz?month=2026-11',
    };
    expect(homeHeroContent(custom)).toEqual(custom);
  });
});
