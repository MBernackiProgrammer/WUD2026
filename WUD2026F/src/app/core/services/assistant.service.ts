import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, afterNextRender, computed, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { CONTENT_API_URL } from '../data/content-api';
import { ChatMessage, ChatSessionResponse } from '../models/chat.model';
import { readStorage, writeStorage } from '../utils/browser-storage';
import { createRequestId } from '../utils/request-id';

const STORAGE_KEY = 'philharmonic-curator-session';
interface Credentials {
  sessionId: string;
  token: string;
}
interface PendingRequest {
  requestId: string;
  expectedTurn: number;
  text: string;
}

/** One shared conversation for the floating window and /asystent. The API owns its history and memory. */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly http = inject(HttpClient);
  private credentials: Credentials | null = null;
  private turn = 0;
  private lastRequest: PendingRequest | null = null;
  readonly messages = signal<ChatMessage[]>([]);
  readonly busy = signal(false);
  readonly restoring = signal(false);
  readonly error = signal('');
  readonly pendingQuestion = signal('');
  readonly configured = signal<boolean | null>(null);
  readonly followUps = computed(() =>
    this.messages().some((message) => !message.user && message.events.length > 0)
      ? []
      : (this.messages()
          .filter((message) => !message.user)
          .at(-1)?.followUps ?? []),
  );

  constructor() {
    afterNextRender(() => {
      void this.initialize();
    });
  }

  async checkStatus(): Promise<void> {
    try {
      const status = await firstValueFrom(
        this.http
          .get<{ configured: boolean }>(CONTENT_API_URL + '/chat/status')
          .pipe(timeout(5000)),
      );
      this.configured.set(status.configured);
    } catch {
      this.configured.set(null);
    }
  }

  private async initialize(): Promise<void> {
    void this.checkStatus();
    try {
      const saved: unknown = JSON.parse(readStorage(STORAGE_KEY) || 'null');
      if (
        !saved ||
        typeof saved !== 'object' ||
        !('sessionId' in saved) ||
        !('token' in saved) ||
        typeof saved.sessionId !== 'string' ||
        typeof saved.token !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(saved.sessionId) ||
        !/^[0-9a-f]{64}$/i.test(saved.token)
      )
        return;
      this.credentials = { sessionId: saved.sessionId, token: saved.token };
      this.restoring.set(true);
      await this.reload();
    } catch (error) {
      this.handleError(error);
    } finally {
      this.restoring.set(false);
    }
  }

  async ask(raw: string): Promise<boolean> {
    const text = raw.trim();
    if (!text || text.length > 2000 || this.busy() || this.restoring()) return false;
    this.lastRequest = { requestId: createRequestId(), expectedTurn: this.turn, text };
    this.pendingQuestion.set(text);
    return this.send();
  }

  async retry(): Promise<boolean> {
    if (this.busy() || this.restoring()) return false;
    if (this.lastRequest) return this.send();
    this.restoring.set(true);
    this.error.set('');
    try {
      if (this.credentials) await this.reload();
      else await this.checkStatus();
      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    } finally {
      this.restoring.set(false);
    }
  }

  private async send(): Promise<boolean> {
    if (!this.lastRequest) return false;
    this.busy.set(true);
    this.error.set('');
    try {
      if (!this.credentials) {
        const created = await firstValueFrom(
          this.http
            .post<ChatSessionResponse>(CONTENT_API_URL + '/chat/sessions', {})
            .pipe(timeout(10000)),
        );
        if (!created.token) throw new Error('Missing conversation credentials.');
        this.credentials = { sessionId: created.sessionId, token: created.token };
        this.turn = created.turn;
        this.lastRequest = { ...this.lastRequest, expectedTurn: created.turn };
        writeStorage(STORAGE_KEY, JSON.stringify(this.credentials));
      }
      const response = await firstValueFrom(
        this.http
          .post<ChatSessionResponse>(this.url + '/messages', this.lastRequest, {
            headers: this.headers,
          })
          .pipe(timeout(65000)),
      );
      this.accept(response);
      this.lastRequest = null;
      this.pendingQuestion.set('');
      this.configured.set(true);
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409 && this.credentials) {
        try {
          await this.reload();
          if (this.lastRequest) this.lastRequest = { ...this.lastRequest, expectedTurn: this.turn };
        } catch {
          /* Preserve the pending question for a deliberate retry. */
        }
      }
      this.handleError(error);
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  async reset(): Promise<boolean> {
    if (this.busy() || this.restoring()) return false;
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.credentials)
        await firstValueFrom(
          this.http.delete(this.url, { headers: this.headers }).pipe(timeout(10000)),
        );
      this.forget();
      this.messages.set([]);
      this.pendingQuestion.set('');
      this.lastRequest = null;
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && [401, 410].includes(error.status)) {
        this.forget();
        this.messages.set([]);
        this.pendingQuestion.set('');
        this.lastRequest = null;
        return true;
      }
      this.handleError(error);
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private async reload(): Promise<void> {
    this.accept(
      await firstValueFrom(
        this.http
          .get<ChatSessionResponse>(this.url, { headers: this.headers })
          .pipe(timeout(10000)),
      ),
    );
  }

  private accept(response: ChatSessionResponse): void {
    this.turn = response.turn;
    this.messages.set(response.messages);
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse && [401, 410].includes(error.status)) {
      this.forget();
      this.messages.set([]);
    }
    const message =
      error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
        ? error.error.message
        : null;
    this.error.set(message ?? 'Nie udało się połączyć z przewodnikiem. Spróbuj ponownie.');
  }

  private forget(): void {
    this.credentials = null;
    this.turn = 0;
    writeStorage(STORAGE_KEY, '');
  }

  private get url(): string {
    return CONTENT_API_URL + '/chat/sessions/' + this.credentials!.sessionId;
  }
  private get headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: 'Bearer ' + this.credentials!.token });
  }
}
