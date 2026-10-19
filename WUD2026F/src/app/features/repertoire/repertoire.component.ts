import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  DestroyRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { map } from 'rxjs';
import { catalogSection } from '../../core/utils/catalog-section';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { EventClock } from '../../core/services/event-clock.service';
import { isPastEvent } from '../../core/utils/event-time';
import { PhilharmonicStore } from '../../core/services/philharmonic.store';
import { filterConcerts } from '../../core/utils/event-filters';
import { EventCardComponent } from '../../shared/components/event-card/event-card.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    EventCardComponent,
    IconComponent,
    ButtonModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    CheckboxModule,
    DrawerModule,
    DatePickerModule,
    NgTemplateOutlet,
  ],
  templateUrl: './repertoire.component.html',
})
export class RepertoireComponent {
  readonly store = inject(PhilharmonicStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly controls = viewChild.required<ElementRef<HTMLElement>>('repertoireControls');
  private readonly desktopControls = viewChild<ElementRef<HTMLElement>>('desktopCalendarControls');
  private readonly clock = inject(EventClock);
  private lastScrollKey = '';
  private restoreBrowserPosition = false;
  private scrollRequested = true;
  readonly dateOptions = [
    { label: 'Najbliższe terminy', value: '' },
    { label: 'Dzisiaj', value: 'today' },
    { label: 'Jutro', value: 'tomorrow' },
    { label: 'Ten tydzień', value: 'week' },
    { label: 'Zakres dat', value: 'range' },
    { label: 'Ten weekend', value: 'weekend' },
    { label: 'W tym miesiącu', value: 'month' },
  ];
  readonly isCalendar = toSignal(
    this.route.data.pipe(map((data) => data['catalogSection'] === 'all')),
    { initialValue: false },
  );
  readonly extra = signal<Record<string, string>>({});
  readonly extraKeys = [
    'from',
    'to',
    'audience',
    'mood',
    'room',
    'priceMin',
    'duration',
    'durationMin',
    'durationMax',
    'accessibility',
    'performer',
    'composer',
    'cycle',
    'tag',
    'type',
    'status',
  ];
  readonly extraFields = [
    {
      key: 'audience',
      label: 'Dla kogo?',
      options: ['Dzieci', 'Rodziny', 'Młodzież', 'Szkoły', 'Dorośli', 'Debiutanci'],
    },
    {
      key: 'mood',
      label: 'Nastrój',
      options: ['Classical super hits', 'Emotional', 'Energy', 'Relaks', 'Coś niezwykłego'],
    },
    { key: 'room', label: 'Miejsce', options: [] as string[] },
    { key: 'performer', label: 'Wykonawca', options: [] as string[] },
    { key: 'composer', label: 'Kompozytor', options: [] as string[] },
    { key: 'cycle', label: 'Cykl / festiwal', options: [] as string[] },
    { key: 'tag', label: 'Tag', options: [] as string[] },
  ];
  readonly accessibilityOptions = [
    { label: 'Ruchowa', value: 'mobility' },
    { label: 'Wzrokowa', value: 'visual' },
    { label: 'Słuchowa', value: 'hearing' },
    { label: 'Informacje sensoryczne', value: 'sensory' },
  ];
  readonly statusOptions = [
    { label: 'Dostępne', value: 'available' },
    { label: 'Ostatnie bilety', value: 'last-tickets' },
    { label: 'Brak biletów', value: 'sold-out' },
  ];
  readonly typeOptions = [
    { label: 'Koncert', value: 'concert' },
    { label: 'Cykl', value: 'cycle' },
    { label: 'Festiwal', value: 'festival' },
    { label: 'Wystawa', value: 'exhibition' },
    { label: 'Edukacja', value: 'education' },
    { label: 'Zwiedzanie', value: 'tour' },
    { label: 'Inne', value: 'other' },
  ];
  readonly durationOptions = [
    { label: 'Do 45 min', value: '45' },
    { label: 'Do 90 min', value: '90' },
    { label: 'Powyżej 90 min', value: 'long' },
    { label: 'Własny zakres', value: 'custom' },
  ];
  readonly isEvents = toSignal(
    this.route.data.pipe(map((data) => data['catalogSection'] === 'events')),
    { initialValue: false },
  );
  readonly sectionEvents = computed(() =>
    this.store
      .events()
      .filter(
        (event) =>
          this.isCalendar() ||
          catalogSection(event) === (this.isEvents() ? 'events' : 'repertoire'),
      ),
  );
  readonly categoryOptions = computed(() => [
    {
      label: this.isCalendar() || this.isEvents() ? 'Wszystkie wydarzenia' : 'Wszystkie koncerty',
      value: '',
    },
    ...[...new Set(this.sectionEvents().map((event) => event.category))]
      .sort()
      .map((value) => ({ label: value, value })),
  ]);
  private readonly currentMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);
  readonly month = signal(this.currentMonth);
  readonly selectedMonth = computed(() => {
    const [year, month] = this.month().split('-').map(Number);
    return new Date(year, month - 1, 1, 12);
  });
  readonly monthHeading = computed(() => {
    const date = this.selectedMonth();
    const month = new Intl.DateTimeFormat('pl-PL', { month: 'long' }).format(date);
    return `${this.isCalendar() || this.isEvents() ? 'Wydarzenia' : 'Koncerty'} na ${month} ${date.getFullYear()}`;
  });
  readonly query = signal('');
  readonly category = signal('');
  readonly period = signal('');
  readonly budget = signal('');
  readonly age = signal('');
  readonly available = signal(false);
  readonly filtersOpen = signal(false);
  readonly earlierExpanded = signal(false);
  readonly activeCount = computed(
    () =>
      [
        this.category(),
        this.period(),
        this.budget(),
        this.age(),
        this.available(),
        ...Object.values(this.extra()),
      ].filter((value) => value !== '' && value !== false).length,
  );
  readonly filtered = computed(() =>
    filterConcerts(this.sectionEvents(), {
      ...this.extra(),
      query: this.query(),
      category: this.category(),
      period: this.period() || this.month(),
      budget: this.budget(),
      age: this.age(),
      availableOnly: this.available(),
    }),
  );

  readonly earlierEvents = computed(() =>
    this.filtered().filter((event) => isPastEvent(event, this.clock.now())),
  );
  readonly upcomingEvents = computed(() =>
    this.filtered().filter((event) => !isPastEvent(event, this.clock.now())),
  );
  readonly visibleEvents = computed(() =>
    this.earlierExpanded() ? this.filtered() : this.upcomingEvents(),
  );
  readonly nearestUpcoming = computed(() => this.upcomingEvents().at(0));

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const updateHeight = () => {
        this.element.nativeElement.style.setProperty(
          '--repertoire-controls-height',
          `${Math.ceil(Math.max(this.controls().nativeElement.getBoundingClientRect().height, this.desktopControls()?.nativeElement.getBoundingClientRect().height ?? 0))}px`,
        );
      };
      updateHeight();
      const observer = new ResizeObserver(updateHeight);
      observer.observe(this.controls().nativeElement);
      const desktopControls = this.desktopControls();
      if (desktopControls) observer.observe(desktopControls.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((parameters) => {
      this.restoreBrowserPosition = this.router.getCurrentNavigation()?.trigger === 'popstate';
      if (this.restoreBrowserPosition) this.scrollRequested = false;
      const month = parameters.get('month') ?? '';
      this.month.set(/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : this.currentMonth);
      this.query.set(parameters.get('q') ?? '');
      this.category.set(parameters.get('category') ?? '');
      this.period.set(parameters.get('date') ?? '');
      this.budget.set(parameters.get('budget') ?? '');
      this.age.set(parameters.get('age') ?? '');
      this.available.set(parameters.get('available') === '1');
      this.earlierExpanded.set(parameters.get('past') === '1');
      this.extra.set(
        Object.fromEntries(this.extraKeys.map((key) => [key, parameters.get(key) ?? ''])),
      );
    });
    afterRenderEffect((onCleanup) => {
      // Calendar keeps the reader at the page header; filters must not jump to cards.
      if (this.isCalendar() || this.store.eventsLoading()) return;
      const events = this.visibleEvents();
      const key = JSON.stringify([
        this.month(),
        this.query(),
        this.category(),
        this.period(),
        this.budget(),
        this.age(),
        this.available(),
        this.extra(),
        this.earlierExpanded(),
        events.map((event) => [event.id, event.date, event.time]),
      ]);
      if (key === this.lastScrollKey && !this.scrollRequested) return;
      this.lastScrollKey = key;
      // Start at the nearest event; the archive action remains just above the list.
      // Later catalogue refreshes must not move the reader again.
      if (!this.scrollRequested || !events.length || this.restoreBrowserPosition) return;
      const targetId = this.earlierExpanded()
        ? events[0].id
        : (untracked(() => this.nearestUpcoming()?.id) ?? events[0].id);
      // Let router scroll restoration and the final card layout settle first.
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          const target = Array.from(
            this.element.nativeElement.querySelectorAll<HTMLElement>('[data-event-id]'),
          ).find((card) => card.dataset['eventId'] === targetId);
          if (target) {
            target.scrollIntoView({ block: 'start', behavior: 'instant' });
            this.scrollRequested = false;
          }
        });
      });
      onCleanup(() => cancelAnimationFrame(frame));
    });
  }

  fieldOptions(key: string, defaults: string[]): string[] {
    const events = this.sectionEvents();
    const values =
      key === 'room'
        ? events.map((e) => e.room)
        : key === 'performer'
          ? events.flatMap((e) => (e.details?.performers ?? []).map((p) => p.name))
          : key === 'composer'
            ? events.flatMap((e) => (e.details?.works ?? []).map((w) => w.composer ?? ''))
            : key === 'cycle'
              ? events.map((e) => e.details?.collection?.name ?? '')
              : key === 'tag'
                ? events.flatMap((e) =>
                    (e.tags ?? []).filter((t) => !['events', 'repertoire'].includes(t)),
                  )
                : key === 'mood'
                  ? events.map((e) => e.mood)
                  : key === 'audience'
                    ? events.map((e) => e.audience)
                    : [];
    return [...new Set([...defaults, ...values].filter(Boolean))].sort();
  }

  dateValue(key: string): Date | null {
    const value = this.extra()[key];
    return value ? new Date(value + 'T12:00:00') : null;
  }

  changeDate(key: string, date: Date | null): void {
    this.change(
      key,
      date
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        : '',
    );
  }

  moveMonth(offset: number): void {
    const date = new Date(this.selectedMonth());
    date.setMonth(date.getMonth() + offset);
    this.selectMonth(date);
  }

  selectMonth(date: Date | null): void {
    if (!date || Number.isNaN(date.getTime())) return;
    this.change('month', `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }

  change(key: string, value: string): void {
    this.scrollRequested = true;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [key]: value === '' ? null : value,
        ...(key !== 'past' ? { past: null } : {}),
        ...(key === 'month' ? { date: null, from: null, to: null } : {}),
      },
      queryParamsHandling: 'merge',
      replaceUrl: false,
    });
  }

  reset(): void {
    void this.router.navigate([
      this.isCalendar() ? '/kalendarz' : this.isEvents() ? '/wydarzenia' : '/repertuar',
    ]);
  }
}
