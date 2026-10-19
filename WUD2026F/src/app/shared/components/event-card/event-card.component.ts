import { DatePipe } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { Concert } from '../../../core/models/concert.model';
import { EventClock } from '../../../core/services/event-clock.service';
import { ticketState } from '../../../core/utils/ticket-state';
import { isPastEvent } from '../../../core/utils/event-time';
import { PhilharmonicStore } from '../../../core/services/philharmonic.store';
import { IconComponent } from '../icon/icon.component';
@Component({
  selector: 'app-event-card',
  standalone: true,
  imports: [RouterLink, DatePipe, IconComponent, ButtonModule, CardModule, TagModule],
  templateUrl: './event-card.component.html',
})
export class EventCardComponent {
  @Input({ required: true }) event!: Concert;
  readonly store = inject(PhilharmonicStore);
  private readonly clock = inject(EventClock);

  get sellerUrl(): string | null {
    return this.tickets.url;
  }

  get tickets() {
    return ticketState(this.event);
  }

  get isPast(): boolean {
    return isPastEvent(this.event, this.clock.now());
  }

  get isFavorite(): boolean {
    return this.store.favorites().includes(this.event.id);
  }

  get favoriteLabel(): string {
    return `${this.isFavorite ? 'Usuń z ulubionych: ' : 'Zapisz: '}${this.event.title}`;
  }

  toggleFavorite(): void {
    this.store.toggleFavorite(this.event.id);
  }
}
