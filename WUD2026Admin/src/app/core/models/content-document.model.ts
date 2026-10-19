import { Concert } from './concert.model';
import { HeroContent } from './hero-content.model';

export interface EditorEvent extends Concert {
  publicationState: 'draft' | 'published' | 'scheduled';
  publishAt: string | null;
}

export interface ContentDocument {
  revision: number;
  updatedAt: string;
  draftHero: HeroContent;
  publishedHero: HeroContent;
  scheduledHero: HeroContent | null;
  heroPublishAt: string | null;
  events: EditorEvent[];
}
