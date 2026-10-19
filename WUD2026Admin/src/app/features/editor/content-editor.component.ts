import { EventDetails } from '../../core/models/event-details.model';
import { EventDetailsEditorComponent } from './event-details-editor.component';
import { optionalHttpsUrl } from '../../core/utils/https-url.validator';
import { WarsawDatePipe } from '../../core/utils/warsaw-date.pipe';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { DateInputComponent } from '../../shared/components/date-input.component';
import { IconComponent } from '../../shared/components/icon.component';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { DEFAULT_HERO } from '../../core/data/default-hero';
import { PUBLIC_SITE_URL } from '../../core/data/content-api';
import { ContentDocument, EditorEvent } from '../../core/models/content-document.model';
import { HeroContent } from '../../core/models/hero-content.model';
import { ContentEditorService } from '../../core/services/content-editor.service';
import { warsawDateTime, warsawToIso } from '../../core/utils/warsaw-time';

interface HeroTextField {
  name: keyof HeroContent;
  label: string;
  maxLength: number;
  multiline?: boolean;
  help?: string;
}

@Component({
  standalone: true,
  imports: [
    EventDetailsEditorComponent,
    InputNumberModule,
    DateInputComponent,
    IconComponent,
    WarsawDatePipe,
    ReactiveFormsModule,
    DatePipe,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    TagModule,
  ],
  templateUrl: './content-editor.component.html',
})
export class ContentEditorComponent {
  private readonly api = inject(ContentEditorService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly forms = inject(FormBuilder).nonNullable;
  readonly publicSite = PUBLIC_SITE_URL;
  readonly content = signal<ContentDocument | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly tab = signal<'hero' | 'events'>('hero');
  readonly imageFailed = signal(false);
  eventDetails: EventDetails = {};
  readonly extraTags = new FormControl('', { nonNullable: true });
  readonly eventSelected = signal<string | null>(null);
  readonly heroPublishAt = new FormControl('', { nonNullable: true });
  readonly categories = [
    'Symfoniczne',
    'Kameralne',
    'Dla rodzin',
    'Jazz',
    'Filmowe',
    'Zwiedzanie',
    'Wystawy',
    'Recitale',
    'Muzyka świata',
    'Koncerty zewnętrzne',
    'Inne',
  ];
  readonly catalogSections = [
    { label: 'Repertuar — koncerty i muzyka', value: 'repertoire' },
    { label: 'Wydarzenia — zwiedzanie, wystawy i warsztaty', value: 'events' },
  ];
  readonly states = [
    { label: 'Wersja robocza', value: 'draft' },
    { label: 'Opublikowane', value: 'published' },
    { label: 'Zaplanowane', value: 'scheduled' },
  ];
  readonly ticketStates = [
    { label: 'Dostępne', value: 'available' },
    { label: 'Ostatnie bilety', value: 'last-tickets' },
    { label: 'Wyprzedane', value: 'sold-out' },
    { label: 'Niepotwierdzone', value: 'unknown' },
  ];
  readonly images = [
    { label: 'Złota Sala Symfoniczna', value: '/images/building-28-large.webp' },
    { label: 'Biała bryła Filharmonii', value: '/images/building-3-large.webp' },
    { label: 'Foyer i spiralne schody', value: '/images/building-5.jpg' },
    { label: 'Budynek wieczorem', value: '/images/building-41.jpg' },
    { label: 'Wnętrze ze schodami', value: '/images/building-7.jpg' },
  ];
  private readonly baseEventImages = [
    { label: 'Sala Symfoniczna', value: 'building-28.jpg' },
    { label: 'Foyer', value: 'building-5.jpg' },
    { label: 'Budynek', value: 'building-3.jpg' },
    { label: 'Budynek wieczorem', value: 'building-41.jpg' },
    { label: 'Schody', value: 'building-7.jpg' },
  ];
  readonly eventImages = computed(() => {
    const images = this.content()?.events.map((event) => event.image) ?? [];
    const known = new Set(this.baseEventImages.map((image) => image.value));
    return [
      ...this.baseEventImages,
      ...[...new Set(images)]
        .filter((value) => !known.has(value))
        .map((value) => ({ label: value, value })),
    ];
  });
  readonly heroFields: HeroTextField[] = [
    { name: 'eyebrow', label: 'Napis nad nagłówkiem', maxLength: 120 },
    { name: 'title', label: 'Nagłówek — pierwsza linia', maxLength: 100 },
    { name: 'highlightedTitle', label: 'Nagłówek — złota linia', maxLength: 100 },
    {
      name: 'description',
      label: 'Opis pod nagłówkiem',
      maxLength: 500,
      multiline: true,
      help: 'Enter rozpoczyna nową linię w hero.',
    },
    { name: 'primaryLabel', label: 'Główny przycisk — tekst', maxLength: 60 },
    {
      name: 'primaryHref',
      label: 'Główny przycisk — ścieżka',
      maxLength: 250,
      help: 'Np. /repertuar lub /wydarzenie/wieczor-z-beethovenem',
    },
    { name: 'secondaryLabel', label: 'Drugi przycisk — tekst', maxLength: 60 },
    {
      name: 'secondaryHref',
      label: 'Drugi przycisk — ścieżka',
      maxLength: 250,
      help: 'Np. /dla-ciebie',
    },
    { name: 'featuredLabel', label: 'Podpis nad promowanym wydarzeniem', maxLength: 100 },
    { name: 'sideText', label: 'Napis na bocznej krawędzi', maxLength: 120 },
    { name: 'caption', label: 'Podpis fotografii', maxLength: 120 },
  ];
  readonly heroForm = this.forms.group({
    eyebrow: [DEFAULT_HERO.eyebrow, [Validators.required, Validators.maxLength(120)]],
    title: [DEFAULT_HERO.title, [Validators.required, Validators.maxLength(100)]],
    highlightedTitle: [
      DEFAULT_HERO.highlightedTitle,
      [Validators.required, Validators.maxLength(100)],
    ],
    description: [DEFAULT_HERO.description, [Validators.required, Validators.maxLength(500)]],
    imageUrl: [
      DEFAULT_HERO.imageUrl,
      [
        Validators.required,
        Validators.maxLength(1000),
        Validators.pattern(/^(\/images\/|https:\/\/)/),
      ],
    ],
    imageAlt: [DEFAULT_HERO.imageAlt, [Validators.required, Validators.maxLength(250)]],
    primaryLabel: [DEFAULT_HERO.primaryLabel, [Validators.required, Validators.maxLength(60)]],
    primaryHref: [
      DEFAULT_HERO.primaryHref,
      [Validators.required, Validators.maxLength(250), Validators.pattern(/^\/(?!\/)/)],
    ],
    secondaryLabel: [DEFAULT_HERO.secondaryLabel, [Validators.required, Validators.maxLength(60)]],
    secondaryHref: [
      DEFAULT_HERO.secondaryHref,
      [Validators.required, Validators.maxLength(250), Validators.pattern(/^\/(?!\/)/)],
    ],
    sideText: [DEFAULT_HERO.sideText, [Validators.required, Validators.maxLength(120)]],
    caption: [DEFAULT_HERO.caption, [Validators.required, Validators.maxLength(120)]],
    featuredEventId: [DEFAULT_HERO.featuredEventId, Validators.required],
    featuredLabel: [DEFAULT_HERO.featuredLabel, [Validators.required, Validators.maxLength(100)]],
  });
  readonly eventForm = this.forms.group({
    id: [
      '',
      [
        Validators.required,
        Validators.maxLength(100),
        Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      ],
    ],
    title: ['', [Validators.required, Validators.maxLength(150)]],
    subtitle: ['', [Validators.required, Validators.maxLength(250)]],
    category: ['Symfoniczne', Validators.required],
    catalogSection: ['repertoire', Validators.required],
    date: ['', Validators.required],
    time: ['19:00', Validators.required],
    duration: [90 as number | null, [Validators.min(5), Validators.max(1440)]],
    room: ['Sala Symfoniczna', [Validators.required, Validators.maxLength(150)]],
    price: [55 as number | null, [Validators.min(0), Validators.max(10000)]],
    ticketUrl: ['', [Validators.maxLength(2048), optionalHttpsUrl]],
    image: ['building-28.jpg', Validators.required],
    audience: ['Dorośli', Validators.required],
    age: [12, [Validators.min(0), Validators.max(120)]],
    mood: ['Wzruszenie', Validators.required],
    artists: ['', [Validators.required, Validators.maxLength(2000)]],
    description: ['', [Validators.required, Validators.maxLength(5000)]],
    programText: [''],
    status: ['unknown', Validators.required],
    publicationState: ['draft', Validators.required],
    publishAt: [''],
  });
  readonly eventOptions = computed(() =>
    (this.content()?.events ?? []).map((event) => ({
      label: `${event.title} · ${event.date}${event.publicationState === 'draft' ? ' · szkic' : ''}`,
      value: event.id,
    })),
  );

  constructor() {
    this.heroForm.controls.imageUrl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.imageFailed.set(false));
    this.load();
  }

  get preview(): HeroContent {
    return this.heroForm.getRawValue();
  }
  get previewEvent(): EditorEvent | undefined {
    return this.content()?.events.find(
      (event) => event.id === this.heroForm.controls.featuredEventId.value,
    );
  }
  get previewImage(): string {
    return this.imageUrl(this.preview.imageUrl);
  }
  get canPublish(): boolean {
    return (
      !!this.content() &&
      !this.busy() &&
      this.heroForm.pristine &&
      this.heroForm.valid &&
      !this.imageFailed()
    );
  }

  imageUrl(value: string): string {
    return value.startsWith('/images/') ? PUBLIC_SITE_URL + value : value;
  }
  publicationLabel(event: EditorEvent): string {
    if (event.publicationState === 'draft') return 'Szkic';
    if (
      event.publicationState === 'scheduled' &&
      event.publishAt &&
      new Date(event.publishAt) > new Date()
    )
      return 'Zaplanowane';
    return 'Opublikowane';
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .load()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (document) => this.accept(document, true),
        error: (error) => this.showError(error),
      });
  }

  saveHero(): void {
    this.heroForm.markAllAsTouched();
    if (this.heroForm.invalid || this.busy() || !this.content()) return;
    this.run(
      this.api.saveHero(this.content()!.revision, this.heroForm.getRawValue()),
      'Wersja robocza hero została zapisana.',
      true,
    );
  }

  publishHero(schedule: boolean): void {
    if (!this.canPublish) return;
    const publishAt = schedule ? warsawToIso(this.heroPublishAt.value) : null;
    if (schedule && (!publishAt || new Date(publishAt).getTime() <= Date.now())) {
      this.error.set('Wybierz przyszły i poprawny termin publikacji w strefie Europe/Warsaw.');
      return;
    }
    this.run(
      this.api.publishHero(this.content()!.revision, publishAt),
      schedule
        ? 'Zaplanowano publikację zapisanej wersji hero.'
        : 'Hero zostało opublikowane na stronie głównej.',
      false,
    );
  }

  cancelSchedule(): void {
    if (!this.content() || this.busy()) return;
    this.run(
      this.api.cancelHeroSchedule(this.content()!.revision),
      'Zaplanowana publikacja została anulowana.',
      false,
    );
  }

  editEvent(event: EditorEvent): void {
    this.eventSelected.set(event.id);
    this.eventDetails = JSON.parse(JSON.stringify(event.details ?? {}));
    this.extraTags.setValue(
      (event.tags ?? []).filter((t) => !['events', 'repertoire'].includes(t)).join('\n'),
    );
    this.eventForm.reset({
      ...event,
      catalogSection: event.tags?.includes('events') ? 'events' : 'repertoire',
      ticketUrl: event.ticketUrl ?? '',
      programText: event.program.join('\n'),
      publishAt: warsawDateTime(event.publishAt),
    });
    this.eventForm.controls.id.disable();
  }

  newEvent(): void {
    this.eventSelected.set(null);
    this.eventDetails = { type: 'concert' };
    this.extraTags.setValue('');
    this.eventForm.controls.id.enable();
    this.eventForm.reset({
      id: '',
      title: '',
      subtitle: '',
      category: 'Symfoniczne',
      catalogSection: 'repertoire',
      date: '',
      time: '19:00',
      duration: 90,
      room: 'Sala Symfoniczna',
      price: 55,
      ticketUrl: '',
      image: 'building-28.jpg',
      audience: 'Dorośli',
      age: 12,
      mood: 'Wzruszenie',
      artists: '',
      description: '',
      programText: '',
      status: 'unknown',
      publicationState: 'draft',
      publishAt: '',
    });
  }

  saveEvent(): void {
    this.eventForm.markAllAsTouched();
    if (this.eventForm.invalid || !this.content() || this.busy()) return;
    const value = this.eventForm.getRawValue();
    const publishAt = value.publicationState === 'scheduled' ? warsawToIso(value.publishAt) : null;
    if (
      value.publicationState === 'scheduled' &&
      (!publishAt || new Date(publishAt).getTime() <= Date.now())
    ) {
      this.error.set('Wybierz przyszły termin publikacji wydarzenia.');
      return;
    }
    const { programText, catalogSection, ...fields } = value;
    const event: EditorEvent = {
      ...fields,
      details: this.eventDetails,
      tags: [
        ...new Set([
          ...this.extraTags.value
            .split('\n')
            .map((t) => t.trim())
            .filter((t) => t && !['events', 'repertoire'].includes(t)),
          catalogSection,
        ]),
      ],
      ticketUrl: value.ticketUrl.trim() || null,
      sourceUrl: this.content()?.events.find((item) => item.id === value.id)?.sourceUrl ?? null,
      status: value.status as EditorEvent['status'],
      publicationState: value.publicationState as EditorEvent['publicationState'],
      program: programText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      publishAt,
    };
    this.busy.set(true);
    this.error.set('');
    this.api
      .saveEvent(this.content()!.revision, event)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (document) => {
          this.accept(document, false);
          this.editEvent(document.events.find((item) => item.id === event.id)!);
          this.messages.add({ severity: 'success', summary: 'Wydarzenie zostało zapisane.' });
        },
        error: (error) => this.showError(error),
      });
  }

  private run(request: Observable<ContentDocument>, message: string, resetHero: boolean): void {
    this.busy.set(true);
    this.error.set('');
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (document) => {
          this.accept(document, resetHero);
          this.messages.add({ severity: 'success', summary: message });
        },
        error: (error) => this.showError(error),
      });
  }

  private accept(document: ContentDocument, resetHero: boolean): void {
    this.content.set(document);
    if (resetHero) this.heroForm.reset(document.draftHero);
  }

  private showError(error: unknown): void {
    const response = error as HttpErrorResponse;
    this.error.set(
      typeof response.error?.message === 'string'
        ? response.error.message
        : response.status === 0
          ? 'Nie udało się połączyć z serwerem. Spróbuj ponownie za chwilę.'
          : 'Nie udało się zapisać lub pobrać danych. Sprawdź połączenie i spróbuj ponownie.',
    );
  }
}
