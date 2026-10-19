import { DEFAULT_HERO } from '../data/default-hero';
import { HeroContent } from '../models/hero-content.model';

/** Replace only the original starter copy; editorial changes remain editable in the CMS. */
export function homeHeroContent(hero: HeroContent): HeroContent {
  return {
    ...hero,
    title: hero.title === 'Poczuj więcej.' ? DEFAULT_HERO.title : hero.title,
    highlightedTitle:
      hero.highlightedTitle === 'Usłysz na żywo.'
        ? DEFAULT_HERO.highlightedTitle
        : hero.highlightedTitle,
    eyebrow:
      hero.eyebrow === 'FILHARMONIA W SZCZECINIE · SEZON 2026/27'
        ? DEFAULT_HERO.eyebrow
        : hero.eyebrow,
    description: [
      'Są emocje, których nie da się opowiedzieć.\nOdkryj je w Filharmonii. To również Twoje miejsce.',
      'Twoje miejsce w świecie muzyki. Odkryj koncerty, spotkania i historie, które zostają z Tobą.',
    ].includes(hero.description)
      ? DEFAULT_HERO.description
      : hero.description,
    primaryLabel:
      hero.primaryLabel === 'Odkryj repertuar' ? DEFAULT_HERO.primaryLabel : hero.primaryLabel,
    primaryHref: hero.primaryHref === '/repertuar' ? '/kalendarz' : hero.primaryHref,
  };
}
