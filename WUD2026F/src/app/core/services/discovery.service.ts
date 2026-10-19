import { eventArtists, artistKey } from '../utils/event-artists';
import { Injectable, afterRenderEffect, computed, inject, signal, untracked } from '@angular/core';
import { AccountService } from './account.service';
import { PhilharmonicStore } from './philharmonic.store';
import { EventClock } from './event-clock.service';
import { isPastEvent } from '../utils/event-time';
import { Concert } from '../models/concert.model';
import { readStorage, writeStorage } from '../utils/browser-storage';

/** Deterministic suggestions from saved events and this account's local viewing history. */
@Injectable({ providedIn: 'root' })
export class DiscoveryService {
  private readonly account = inject(AccountService);
  private readonly store = inject(PhilharmonicStore);
  private readonly clock = inject(EventClock);
  private readonly viewed = signal<Record<string, number>>({});
  readonly upcoming = computed(() =>
    this.store
      .events()
      .filter((e) => !isPastEvent(e, this.clock.now()))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.id.localeCompare(b.id)),
  );
  readonly recommended = computed(() =>
    [...this.upcoming()]
      .sort(
        (a, b) =>
          Number(!!b.details?.promoted) - Number(!!a.details?.promoted) ||
          (b.details?.promotionPriority ?? 0) - (a.details?.promotionPriority ?? 0) ||
          (a.date + a.time).localeCompare(b.date + b.time),
      )
      .slice(0, 10),
  );
  readonly personalized = computed(() => {
    if (!this.account.user()) return [];
    const favorites = this.store.favorites();
    const artistFavorites = this.account.user()?.favoriteArtistIds ?? [];
    const views = this.viewed();
    const references = this.store.events().filter((e) => favorites.includes(e.id) || views[e.id]);
    const score = (event: Concert) =>
      references.reduce((sum, ref) => {
        const weight = (favorites.includes(ref.id) ? 4 : 0) + Math.min(views[ref.id] ?? 0, 3);
        return (
          sum +
          weight *
            (Number(event.category === ref.category) * 3 +
              Number(!!event.mood && event.mood === ref.mood) +
              Number(
                !!event.details?.collection?.name &&
                  event.details.collection.name === ref.details?.collection?.name,
              ) *
                4 +
              (event.tags ?? []).filter(
                (t) => !['events', 'repertoire'].includes(t) && ref.tags?.includes(t),
              ).length *
                2)
        );
      }, 0) +
      eventArtists(event).filter((artist) =>
        artistFavorites.includes('nazwa-' + artistKey(artist.name)),
      ).length *
        20;
    return this.upcoming()
      .filter((e) => !favorites.includes(e.id))
      .map((event) => ({ event, score: score(event) }))
      .filter((x) => x.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (a.event.date + a.event.time).localeCompare(b.event.date + b.event.time),
      )
      .slice(0, 8)
      .map((x) => x.event);
  });
  readonly exampleTicket = computed(
    () =>
      this.upcoming().find(
        (e) => e.details?.type === 'concert' || e.tags?.includes('repertoire'),
      ) ?? this.upcoming()[0],
  );
  constructor() {
    afterRenderEffect(() => {
      const user = this.account.user();
      untracked(() => {
        let counts: Record<string, number> = {};
        if (user) {
          try {
            const value = JSON.parse(readStorage('philharmonic-views-' + user.id) || '{}');
            if (value && typeof value === 'object' && !Array.isArray(value))
              counts = Object.fromEntries(
                Object.entries(value)
                  .filter(([, n]) => typeof n === 'number' && Number.isFinite(n) && n > 0)
                  .slice(-100),
              ) as Record<string, number>;
          } catch {
            /* Optional local history may be unavailable. */
          }
        }
        this.viewed.set(counts);
      });
    });
  }
  recordView(event: Concert): void {
    const user = this.account.user();
    if (!user) return;
    const next = { ...this.viewed(), [event.id]: Math.min((this.viewed()[event.id] ?? 0) + 1, 10) };
    this.viewed.set(next);
    writeStorage('philharmonic-views-' + user.id, JSON.stringify(next));
  }
}
