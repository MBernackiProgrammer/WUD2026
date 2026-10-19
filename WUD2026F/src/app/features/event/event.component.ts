import { whyAttend } from '../../core/utils/why-attend';
import { eventArtists } from '../../core/utils/event-artists';
import { WavePlayerComponent } from '../../shared/components/wave-player/wave-player.component';
import { DatePipe } from '@angular/common';
import { Component, afterRenderEffect, computed, inject, signal, untracked } from '@angular/core';
import { DiscoveryService } from '../../core/services/discovery.service';
import { AccountService } from '../../core/services/account.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { EventCardComponent } from '../../shared/components/event-card/event-card.component';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { Concert } from '../../core/models/concert.model';
import { EventClock } from '../../core/services/event-clock.service';
import { isPastEvent } from '../../core/utils/event-time';
import { ticketState } from '../../core/utils/ticket-state';
import { PhilharmonicStore } from '../../core/services/philharmonic.store';
import { CONTENT_API_URL } from '../../core/data/content-api';
import { catalogSection } from '../../core/utils/catalog-section';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    IconComponent,
    ButtonModule,
    AccordionModule,
    DialogModule,
    WavePlayerComponent,
    EventCardComponent,
  ],
  templateUrl: './event.component.html',
})
export class EventComponent {
  readonly store = inject(PhilharmonicStore);
  private readonly eventId = signal<string | null>(null);
  readonly event = computed(() => this.store.events().find((event) => event.id === this.eventId()));
  readonly isNonMusicalEvent = computed(() => {
    const event = this.event();
    return event ? catalogSection(event) === 'events' : false;
  });
  private readonly clock = inject(EventClock);
  readonly tickets = computed(() => ticketState(this.event()));
  readonly sellerUrl = computed(() => this.tickets().url);
  readonly isPast = computed(() => {
    const event = this.event();
    return event ? isPastEvent(event, this.clock.now()) : false;
  });
  readonly whyAttend = computed(() => (this.event() ? whyAttend(this.event()!) : ''));
  readonly descriptionExpanded = signal(false);
  readonly performers = computed(() => (this.event() ? eventArtists(this.event()!) : []));
  readonly descriptionParagraphs = computed(() => {
    const event = this.event();
    if (!event) return [];
    // Remove only exact repetitions produced by the legacy importer; the source stays intact.
    let text = event.description
      .replace('Wykonawcy: ' + event.artists + '.', '')
      .replace(
        'Szczegółowe informacje udostępnia organizator na oficjalnej stronie wydarzenia.',
        '',
      )
      .trim();
    if (text === event.subtitle || text === event.subtitle + '.') return [];
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length > 1) return paragraphs;
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/u);
    const result: string[] = [];
    let current = '';
    for (const sentence of sentences) {
      if (current.length > 400) {
        result.push(current);
        current = '';
      }
      current += (current ? ' ' : '') + sentence;
    }
    if (current) result.push(current);
    return result;
  });
  readonly visibleDescription = computed(() =>
    this.descriptionExpanded()
      ? this.descriptionParagraphs()
      : this.descriptionParagraphs().slice(0, 2),
  );
  readonly calendarOpen = signal(false);
  readonly shareOpen = signal(false);
  readonly sharedUrl = signal('');
  readonly details = computed(() => this.event()?.details ?? {});
  readonly address = computed(
    () =>
      this.details().venue?.address ||
      (this.event()?.room?.includes('poza') ? '' : 'ul. Małopolska 48, Szczecin'),
  );
  readonly mapsUrl = computed(
    () =>
      'https://www.google.com/maps/dir/?api=1&destination=' +
      encodeURIComponent([this.event()?.room, this.address()].filter(Boolean).join(', ')),
  );
  readonly similar = computed(() => {
    const current = this.event();
    if (!current) return [];
    return this.store
      .events()
      .filter(
        (e) =>
          e.id !== current.id &&
          !isPastEvent(e, this.clock.now()) &&
          (e.details?.promoted ||
            e.category === current.category ||
            (e.details?.collection?.name &&
              e.details.collection.name === current.details?.collection?.name)),
      )
      .sort(
        (a, b) =>
          Number(!!b.details?.promoted) - Number(!!a.details?.promoted) ||
          (b.details?.promotionPriority ?? 0) - (a.details?.promotionPriority ?? 0) ||
          (a.date + a.time).localeCompare(b.date + b.time),
      )
      .slice(0, 3);
  });
  googleCalendar(event: Concert): string {
    return CONTENT_API_URL + '/events/' + encodeURIComponent(event.id) + '/calendar/google';
  }
  async share(): Promise<void> {
    const url = location.href;
    this.sharedUrl.set(url);
    if (navigator.share) {
      try {
        await navigator.share({ title: this.event()?.title, url });
        return;
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') return;
      }
    }
    this.shareOpen.set(true);
  }
  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.sharedUrl());
      this.store.notify('Link został skopiowany.');
    } catch {
      this.store.notify('Zaznacz i skopiuj link z pola poniżej.');
    }
  }
  private readonly route = inject(ActivatedRoute);

  constructor() {
    const discovery = inject(DiscoveryService);
    const account = inject(AccountService);
    let recorded = '';
    afterRenderEffect(() => {
      const event = this.event();
      const user = account.user();
      if (event && user && recorded !== user.id + ':' + event.id) {
        recorded = user.id + ':' + event.id;
        untracked(() => discovery.recordView(event));
      }
    });
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((parameters) => {
      this.eventId.set(parameters.get('id'));
      this.descriptionExpanded.set(false);
    });
  }

  calendarFile(event: Concert): string {
    return CONTENT_API_URL + '/events/' + encodeURIComponent(event.id) + '/calendar.ics';
  }
}
