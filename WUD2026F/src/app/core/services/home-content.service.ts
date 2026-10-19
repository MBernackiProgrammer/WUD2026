import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Subscription, timeout } from 'rxjs';
import { CONTENT_API_URL } from '../data/content-api';
import { DEFAULT_HERO } from '../data/default-hero';
import { CONCERTS } from '../data/demo-concerts';
import { Concert } from '../models/concert.model';
import { HeroContent } from '../models/hero-content.model';

export interface HomePageResponse {
  hero: HeroContent;
  featuredEvent: Concert | null;
  revision: number;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class HomeContentService {
  private readonly http = inject(HttpClient);
  private request?: Subscription;
  readonly hero = signal<HeroContent>(DEFAULT_HERO);
  readonly featuredEvent = signal<Concert | null>(CONCERTS[0]);
  readonly preview = signal(false);
  readonly failed = signal(false);

  load(preview: boolean): void {
    this.request?.unsubscribe();
    this.preview.set(preview);
    this.failed.set(false);
    this.hero.set(DEFAULT_HERO);
    this.featuredEvent.set(CONCERTS[0]);
    const endpoint = preview ? '/admin/homepage-preview' : '/homepage';
    this.request = this.http
      .get<HomePageResponse>(CONTENT_API_URL + endpoint, { transferCache: false })
      .pipe(timeout(2000))
      .subscribe({
        next: (content) => {
          this.hero.set(content.hero);
          this.featuredEvent.set(content.featuredEvent);
        },
        error: () => this.failed.set(true),
      });
  }
}
