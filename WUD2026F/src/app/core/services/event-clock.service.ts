import { DestroyRef, Injectable, afterNextRender, inject, signal } from '@angular/core';

/** Shared clock: refresh archive styling while a page remains open, without SSR timers. */
@Injectable({ providedIn: 'root' })
export class EventClock {
  readonly now = signal(new Date());

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.now.set(new Date());
      const timer = setInterval(() => this.now.set(new Date()), 30000);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }
}
