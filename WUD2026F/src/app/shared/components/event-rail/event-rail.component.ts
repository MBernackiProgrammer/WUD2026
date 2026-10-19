import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Input,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Concert } from '../../../core/models/concert.model';
import { PhilharmonicStore } from '../../../core/services/philharmonic.store';
import { ticketState } from '../../../core/utils/ticket-state';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-event-rail',
  imports: [RouterLink, DatePipe, IconComponent],
  templateUrl: './event-rail.component.html',
  styleUrl: './event-rail.component.scss',
})
export class EventRailComponent {
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() events: Concert[] = [];
  @Input() loading = false;
  readonly store = inject(PhilharmonicStore);
  readonly ticketState = ticketState;
  readonly canScrollBack = signal(false);
  readonly canScrollForward = signal(false);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const track = this.track().nativeElement;
      const update = () => this.updateNavigation();
      const resize = new ResizeObserver(update);
      resize.observe(track);
      const content = new MutationObserver(update);
      content.observe(track, { childList: true });
      this.updateNavigation();
      destroyRef.onDestroy(() => {
        resize.disconnect();
        content.disconnect();
      });
    });
  }

  updateNavigation(): void {
    const track = this.track().nativeElement;
    const style = getComputedStyle(track);
    // Scroll snapping may leave the track offset by its small inner padding.
    const startTolerance = (parseFloat(style.paddingLeft) || 0) + 1;
    const endTolerance = (parseFloat(style.paddingRight) || 0) + 1;
    this.canScrollBack.set(track.scrollLeft > startTolerance);
    this.canScrollForward.set(
      track.scrollWidth - track.clientWidth - track.scrollLeft > endTolerance,
    );
  }
  scroll(track: HTMLElement, direction: number): void {
    track.scrollBy({
      left: direction * track.clientWidth * 0.85,
      behavior:
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.classList.contains('reduce-motion')
          ? 'instant'
          : 'smooth',
    });
  }
}
