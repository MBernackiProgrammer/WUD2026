import { Injectable, signal } from '@angular/core';

/** Opens the single application-level chat overlay without embedding it in routed content. */
@Injectable({ providedIn: 'root' })
export class AssistantDialogService {
  readonly openRequest = signal(0);

  open(): void {
    this.openRequest.update((request) => request + 1);
  }
}
