import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, afterNextRender, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { CONTENT_API_URL } from '../data/content-api';

export type AccountRole = 'User' | 'Admin' | 'School';
export interface AccountUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
  displayName: string;
  phoneNumber: string | null;
  schoolName: string;
  schoolAddress: string;
  createdAt: string;
  roles: AccountRole[];
  hasPassword: boolean;
  logins: string[];
  favoriteEventIds: string[];
  favoriteArtistIds?: string[];
}
export interface LoginProvider {
  name: string;
  configured: boolean;
}
interface Session {
  user: AccountUser | null;
  providers: LoginProvider[];
  emailEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  readonly user = signal<AccountUser | null>(null);
  readonly loading = signal(true);
  readonly available = signal(true);
  readonly providers = signal<LoginProvider[]>([]);
  readonly emailEnabled = signal(false);
  readonly savingFavorite = signal(false);

  async toggleFavorite(id: string): Promise<boolean> {
    const user = this.user();
    if (!user || !this.available() || this.savingFavorite()) return false;
    const eventIds = user.favoriteEventIds.includes(id)
      ? user.favoriteEventIds.filter((eventId) => eventId !== id)
      : [...user.favoriteEventIds, id];
    this.savingFavorite.set(true);
    try {
      await this.request('PUT', '/favorites', { eventIds, userId: user.id });
      if (this.user()?.id !== user.id) return false;
      this.user.update((current) => (current ? { ...current, favoriteEventIds: eventIds } : null));
      return true;
    } finally {
      this.savingFavorite.set(false);
    }
  }
  readonly savingArtist = signal(false);
  async toggleArtistFavorite(id: string): Promise<boolean> {
    const user = this.user();
    if (!user || !this.available() || this.savingArtist()) return false;
    const saved = user.favoriteArtistIds ?? [];
    const artistIds = saved.includes(id) ? saved.filter((key) => key !== id) : [...saved, id];
    this.savingArtist.set(true);
    try {
      await this.request('PUT', '/favorite-artists', { artistIds, userId: user.id });
      if (this.user()?.id !== user.id) return false;
      this.user.update((current) =>
        current ? { ...current, favoriteArtistIds: artistIds } : null,
      );
      return true;
    } finally {
      this.savingArtist.set(false);
    }
  }
  constructor() {
    afterNextRender(() => {
      void this.refresh().catch(() => {});
    });
  }
  async refresh(): Promise<void> {
    try {
      const session = await firstValueFrom(
        this.http
          .get<Session>(CONTENT_API_URL + '/account/session', {
            withCredentials: true,
            transferCache: false,
          })
          .pipe(timeout(10000)),
      );
      this.user.set(session.user);
      this.providers.set(session.providers);
      this.emailEnabled.set(session.emailEnabled);
      this.available.set(true);
    } catch (error) {
      this.available.set(false);
      throw error;
    } finally {
      this.loading.set(false);
    }
  }
  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const csrf = await firstValueFrom(
      this.http
        .get<{ token: string }>(CONTENT_API_URL + '/account/csrf', {
          withCredentials: true,
          transferCache: false,
        })
        .pipe(timeout(10000)),
    );
    return firstValueFrom(
      this.http
        .request<T>(method, CONTENT_API_URL + '/account' + path, {
          body,
          withCredentials: true,
          headers: { 'X-CSRF-TOKEN': csrf.token },
          transferCache: false,
        })
        .pipe(timeout(20000)),
    );
  }
  async external(provider: string, link = false): Promise<void> {
    const csrf = await firstValueFrom(
      this.http.get<{ token: string }>(CONTENT_API_URL + '/account/csrf', {
        withCredentials: true,
        transferCache: false,
      }),
    );
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = CONTENT_API_URL + '/account/external/' + encodeURIComponent(provider);
    for (const [name, value] of Object.entries({
      __RequestVerificationToken: csrf.token,
      frontend: location.origin,
      link: String(link),
    })) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.append(input);
    }
    document.body.append(form);
    form.submit();
    form.remove();
  }
  async users(query: string, page: number): Promise<{ total: number; items: AccountUser[] }> {
    return firstValueFrom(
      this.http.get<{ total: number; items: AccountUser[] }>(CONTENT_API_URL + '/account/users', {
        params: { q: query, page },
        withCredentials: true,
        transferCache: false,
      }),
    );
  }
  message(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error?.message === 'string') return error.error.message;
      if (error.status === 401) return 'Sesja wygasła. Zaloguj się ponownie.';
      if (error.status === 403) return 'Nie masz uprawnień do tej operacji.';
      if (error.status === 429) return 'Zbyt wiele prób. Spróbuj ponownie za minutę.';
    }
    return 'Nie udało się połączyć. Spróbuj ponownie.';
  }
}
