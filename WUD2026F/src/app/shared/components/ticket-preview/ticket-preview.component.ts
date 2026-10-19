import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Concert } from '../../../core/models/concert.model';
import { IconComponent } from '../icon/icon.component';
@Component({
  selector: 'app-ticket-preview',
  imports: [DatePipe, RouterLink, IconComponent],
  template: `
    <article class="ticket-preview">
      <img
        [src]="'/images/' + event.image"
        alt=""
        width="180"
        height="180"
      />
      <div class="ticket-info">
        <p class="ticket-caption">
          <app-icon name="ticket" />
          Twoja nadchodząca wizyta
          <span>Przykładowy bilet</span>
        </p>
        <h3>{{ event.title }}</h3>
        <p>{{ event.date | date: 'dd.MM.yyyy' }} · {{ event.time }} · {{ event.room }}</p>
        <small>Podgląd biletu — nie uprawnia do wejścia.</small>
      </div>
      <div class="ticket-links">
        <a
          class="button dark"
          [href]="directions()"
          target="_blank"
          rel="noopener"
        >
          Jak dotrzeć
          <app-icon name="pin" />
        </a>
        <a
          class="button outline"
          [routerLink]="['/wydarzenie', event.id]"
        >
          Więcej informacji
          <app-icon name="arrow" />
        </a>
        <a
          class="text-link"
          [routerLink]="['/wydarzenie', event.id]"
          fragment="event-program"
        >
          Program wydarzenia
          <app-icon name="music" />
        </a>
      </div>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .ticket-preview {
        display: flex;
        align-items: center;
        gap: 24px;
        padding: 24px;
        background: var(--warm);
        border: 1px solid var(--line);
        border-radius: 16px;
      }
      img {
        width: 100px;
        height: 120px;
        object-fit: cover;
        border-radius: 8px;
      }
      .ticket-info {
        flex: 1;
        min-width: 0;
      }
      h3 {
        font-size: 24px;
        margin: 0 0 10px;
      }
      .ticket-caption {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 12px;
        color: var(--gold-dark);
        margin-bottom: 12px;
      }
      .ticket-caption span {
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 3px 8px;
        background: var(--paper);
        color: var(--muted);
      }
      p {
        font-size: 14px;
        margin-bottom: 8px;
      }
      small {
        color: var(--muted);
        font-size: 11px;
      }
      .ticket-links {
        display: grid;
        gap: 8px;
      }
      .ticket-links .button {
        min-height: 44px;
        font-size: 12px;
      }
      app-icon {
        width: 18px;
        height: 18px;
      }
      .text-link {
        font-size: 12px;
        justify-content: center;
        min-height: 44px;
      }
      @media (max-width: 767px) {
        .ticket-preview {
          flex-wrap: wrap;
          gap: 16px;
          padding: 20px;
        }
        img {
          width: 64px;
          height: 80px;
        }
        .ticket-info {
          flex-basis: calc(100% - 80px);
        }
        h3 {
          font-size: 21px;
        }
        .ticket-links {
          width: 100%;
          grid-template-columns: 1fr 1fr;
        }
        .ticket-links .text-link {
          grid-column: 1/-1;
        }
        .ticket-caption {
          line-height: 1.5;
        }
      }
      @media (max-width: 359px) {
        .ticket-links {
          grid-template-columns: 1fr;
        }
        .ticket-links .text-link {
          grid-column: auto;
        }
      }
    `,
  ],
})
export class TicketPreviewComponent {
  @Input({ required: true }) event!: Concert;
  directions(): string {
    return (
      'https://www.google.com/maps/dir/?api=1&destination=' +
      encodeURIComponent(
        this.event.details?.venue?.address || 'Filharmonia Szczecin, Małopolska 48, Szczecin',
      )
    );
  }
}
