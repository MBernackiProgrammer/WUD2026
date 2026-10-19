import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { CONTENT_API_URL } from '../../../core/data/content-api';
import { ChatEvent } from '../../../core/models/chat.model';
import { AssistantService } from '../../../core/services/assistant.service';
import { ticketUrl } from '../../../core/utils/ticket-url';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-curator-conversation',
  imports: [DatePipe, RouterLink, ButtonModule, DialogModule, IconComponent],
  templateUrl: './curator-conversation.component.html',
})
export class CuratorConversationComponent {
  readonly chat = inject(AssistantService);
  readonly ticketLink = ticketUrl;
  readonly calendarEvent = signal<ChatEvent | null>(null);
  private calendarTrigger: HTMLElement | null = null;
  @Output() followUp = new EventEmitter<string>();

  openCalendar(card: ChatEvent, event: Event): void {
    this.calendarTrigger = event.currentTarget as HTMLElement;
    this.calendarEvent.set(card);
  }

  restoreCalendarFocus(): void {
    this.calendarTrigger?.focus({ preventScroll: true });
    this.calendarTrigger = null;
  }

  calendarFile(id: string): string {
    return CONTENT_API_URL + '/events/' + encodeURIComponent(id) + '/calendar.ics';
  }
  googleLink(value: string | null): string | null {
    try {
      return value && new URL(value).hostname === 'calendar.google.com' ? ticketUrl(value) : null;
    } catch {
      return null;
    }
  }
}
