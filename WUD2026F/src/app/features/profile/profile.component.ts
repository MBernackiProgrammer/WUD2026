import { AccountService } from '../../core/services/account.service';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PhilharmonicStore } from '../../core/services/philharmonic.store';
import { EventClock } from '../../core/services/event-clock.service';
import { artistKey, eventArtists, artistUpcomingEvents } from '../../core/utils/event-artists';
import { EventCardComponent } from '../../shared/components/event-card/event-card.component';
import { ORCHESTRA } from '../institution/orchestra.data';
import { ARTIST_BACKGROUNDS } from './artist-backgrounds';
import { IconComponent } from '../../shared/components/icon/icon.component';
@Component({
  standalone: true,
  imports: [RouterLink, DatePipe, EventCardComponent, IconComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  readonly store = inject(PhilharmonicStore);
  readonly account = inject(AccountService);
  readonly favoriteKey = computed(() =>
    this.artist() ? 'nazwa-' + artistKey(this.artist()!.name) : '',
  );
  readonly isFavorite = computed(() =>
    (this.account.user()?.favoriteArtistIds ?? []).includes(this.favoriteKey()),
  );
  async toggleFavorite() {
    try {
      const saved = await this.account.toggleArtistFavorite(this.favoriteKey());
      if (saved)
        this.store.notify(
          this.isFavorite() ? 'Dodano artystę do ulubionych' : 'Usunięto artystę z ulubionych',
        );
    } catch (error) {
      this.store.notify(this.account.message(error));
    }
  }

  private readonly clock = inject(EventClock);
  private readonly route = inject(ActivatedRoute);
  readonly id = signal('');
  readonly isArtist = this.route.snapshot.routeConfig?.path?.startsWith('artysta') ?? false;
  readonly artist = computed(() => {
    if (!this.isArtist) return undefined;
    const credits = this.store.events().flatMap(eventArtists);
    const found = credits.find(
      (p) => p.id === this.id() || 'nazwa-' + artistKey(p.name) === this.id(),
    );
    if (!found) return undefined;
    const key = artistKey(found.name);
    const same = credits.filter((p) => artistKey(p.name) === key);
    const background = ARTIST_BACKGROUNDS[key];
    const member = ORCHESTRA.flatMap((g) => g.people).find((p) => artistKey(p.name) === key);
    const roles = [...new Set(same.map((p) => p.role).filter((role): role is string => !!role))];
    const biography =
      same.find((p) => p.biography?.trim())?.biography || background?.biography || member?.bio;
    const sources = [
      ...new Set(
        this.store
          .events()
          .filter((e) => eventArtists(e).some((p) => artistKey(p.name) === key))
          .map((e) => e.sourceUrl)
          .filter((url): url is string => !!url),
      ),
    ];
    return {
      ...found,
      roles,
      biography,
      photoUrl: same.find((p) => p.photoUrl)?.photoUrl || background?.photoUrl || member?.image,
      sourceUrl: background?.sourceUrl || member?.source || sources[0],
      credit: background?.credit,
      isOrchestra: key === 'orkiestra-symfoniczna-filharmonii-w-szczecinie',
    };
  });
  readonly biographyParagraphs = computed(() =>
    (this.artist()?.biography ?? '').split(/\n\s*\n/).filter(Boolean),
  );
  readonly article = computed(() =>
    !this.isArtist
      ? this.store
          .events()
          .flatMap((e) => e.details?.articles ?? [])
          .find((p) => p.id === this.id())
      : undefined,
  );
  readonly related = computed(() => {
    if (this.isArtist) {
      const artist = this.artist();
      return artist ? artistUpcomingEvents(this.store.events(), artist, this.clock.now()) : [];
    }
    return this.store.events().filter((e) => e.details?.articles?.some((a) => a.id === this.id()));
  });
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((p) => this.id.set(p.get('id') ?? ''));
  }
}
