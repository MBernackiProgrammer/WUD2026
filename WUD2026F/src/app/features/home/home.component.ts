import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterNextRender,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { HomeContentService } from '../../core/services/home-content.service';
import { PhilharmonicStore } from '../../core/services/philharmonic.store';
import { EventRailComponent } from '../../shared/components/event-rail/event-rail.component';
import { TicketPreviewComponent } from '../../shared/components/ticket-preview/ticket-preview.component';
import { DiscoveryService } from '../../core/services/discovery.service';
import { AccountService } from '../../core/services/account.service';
import { AssistantDialogService } from '../../core/services/assistant-dialog.service';
import { EventClock } from '../../core/services/event-clock.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { homeHeroContent } from '../../core/utils/home-hero';

@Component({
  standalone: true,
  host: { class: 'home-page' },
  imports: [RouterLink, IconComponent, EventRailComponent, TicketPreviewComponent, ButtonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  readonly store = inject(PhilharmonicStore);
  readonly discovery = inject(DiscoveryService);
  readonly account = inject(AccountService);
  readonly assistantDialog = inject(AssistantDialogService);
  private readonly clock = inject(EventClock);
  private readonly heroVideo = viewChild.required<ElementRef<HTMLVideoElement>>('heroVideo');
  readonly content = inject(HomeContentService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly hero = computed(() => homeHeroContent(this.content.hero()));
  readonly today = computed(() => {
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(this.clock.now());
    return this.discovery
      .upcoming()
      .filter((e) => e.date <= date && (e.details?.endDate ?? e.date) >= date)
      .slice(0, 10);
  });
  readonly rows = computed(() => [
    {
      title: 'Dziś w Filharmonii',
      description: 'Zobacz, co jeszcze przed nami tego dnia.',
      events: this.today(),
    },
    {
      title: 'Najbliższe',
      description: 'Twój kolejny wieczór zaczyna się od jednego wyboru.',
      events: this.discovery.upcoming().slice(0, 12),
    },
    {
      title: 'Polecane',
      description: 'Wydarzenia, na które warto zwrócić uwagę.',
      events: this.discovery.recommended(),
    },
  ]);

  constructor() {
    afterNextRender(() => {
      const video = this.heroVideo().nativeElement;
      video.muted = true;
      video.defaultMuted = true;
      video.controls = false;
      const hero = video.closest<HTMLElement>('.hero')!;
      const root = document.documentElement;
      const updateLauncher = () => {
        const barHeight =
          document.querySelector('.accessibility-bar')?.getBoundingClientRect().height ?? 0;
        root.classList.toggle('home-hero-passed', hero.getBoundingClientRect().bottom <= barHeight);
      };
      const heroObserver = new IntersectionObserver(updateLauncher, { threshold: [0, 1] });
      heroObserver.observe(hero);
      window.addEventListener('scroll', updateLauncher, { passive: true });
      window.addEventListener('resize', updateLauncher);
      updateLauncher();
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const updatePlayback = () => {
        if (reducedMotion.matches || document.documentElement.classList.contains('reduce-motion')) {
          video.pause();
        } else {
          void video.play().catch(() => {
            /* Browser autoplay policy can defer playback. */
          });
        }
      };
      const observer = new MutationObserver(updatePlayback);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      reducedMotion.addEventListener('change', updatePlayback);
      updatePlayback();
      this.destroyRef.onDestroy(() => {
        heroObserver.disconnect();
        window.removeEventListener('scroll', updateLauncher);
        window.removeEventListener('resize', updateLauncher);
        root.classList.remove('home-hero-passed');
        observer.disconnect();
        reducedMotion.removeEventListener('change', updatePlayback);
      });
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((parameters) => {
      this.content.load(parameters.get('heroPreview') === '1');
    });
  }
}
