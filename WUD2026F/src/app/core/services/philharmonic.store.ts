import { HttpClient } from '@angular/common/http';
import { finalize, timeout } from 'rxjs';
import { CONTENT_API_URL } from '../data/content-api';
import { Concert } from '../models/concert.model';
import {
  Injectable,
  PLATFORM_ID,
  TransferState,
  afterNextRender,
  computed,
  inject,
  makeStateKey,
  signal,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { MessageService } from 'primeng/api';
import { CONCERTS } from '../data/demo-concerts';
import { AccountService } from './account.service';

const EVENTS_STATE = makeStateKey<Concert[]>('philharmonic-catalog');

@Injectable({ providedIn: 'root' })
export class PhilharmonicStore {
  private readonly transferState = inject(TransferState);
  private readonly server = isPlatformServer(inject(PLATFORM_ID));
  readonly events = signal(this.transferState.get(EVENTS_STATE, CONCERTS));
  readonly eventsLoading = signal(true);
  private readonly http = inject(HttpClient);
  private readonly account = inject(AccountService);
  readonly canFavorite = computed(() => this.account.available() && this.account.user() !== null);
  readonly savingFavorite = this.account.savingFavorite;
  readonly favorites = computed(() =>
    this.canFavorite() ? (this.account.user()?.favoriteEventIds ?? []) : [],
  );
  private readonly messages = inject(MessageService);

  constructor() {
    const hydrated = this.transferState.hasKey(EVENTS_STATE);
    if (hydrated) {
      this.transferState.remove(EVENTS_STATE);
      this.eventsLoading.set(false);
    } else this.refreshEvents();
    afterNextRender(() => {
      // Start from the exact SSR catalogue, then refresh once hydration has completed.
      if (hydrated) this.refreshEvents();
    });
  }

  refreshEvents(): void {
    this.eventsLoading.set(true);
    this.http
      .get<Concert[]>(CONTENT_API_URL + '/events', { transferCache: false })
      .pipe(
        timeout(2000),
        finalize(() => this.eventsLoading.set(false)),
      )
      .subscribe({
        next: (events) => {
          this.events.set(events);
          if (this.server) this.transferState.set(EVENTS_STATE, events);
        },
        error: () => {
          /* Preserve demonstration content while the local API is unavailable. */
        },
      });
  }

  toggleFavorite(id: string): void {
    if (!this.canFavorite() || this.savingFavorite()) return;
    const wasSaved = this.favorites().includes(id);
    void this.account
      .toggleFavorite(id)
      .then((saved) => {
        if (saved) this.notify(wasSaved ? 'Usunięto z ulubionych' : 'Zapisano w Twoich ulubionych');
      })
      .catch((error) => this.notify(this.account.message(error)));
  }

  notify(message: string): void {
    this.messages.add({ severity: 'info', summary: message, life: 3500 });
  }
}
