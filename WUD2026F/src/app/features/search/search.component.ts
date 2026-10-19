import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PhilharmonicStore } from '../../core/services/philharmonic.store';
import { searchEvents, textSearchScore, searchIntent } from '../../core/utils/content-search';
import { EventClock } from '../../core/services/event-clock.service';
import { isPastEvent } from '../../core/utils/event-time';
import { CheckboxModule } from 'primeng/checkbox';
import { EventCardComponent } from '../../shared/components/event-card/event-card.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    CheckboxModule,
    RouterLink,
    InputTextModule,
    ButtonModule,
    EventCardComponent,
    IconComponent,
  ],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent {
  readonly store = inject(PhilharmonicStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly query = signal('');
  readonly monthHint = computed(() => {
    const intent = searchIntent(this.query());
    return intent.month
      ? new Intl.DateTimeFormat('pl', { month: 'long' }).format(
          new Date(2026, intent.month - 1, 15),
        ) + (intent.year ? ' ' + intent.year : '')
      : '';
  });
  readonly submitted = signal(false);
  readonly previewOpen = signal(false);
  readonly includePast = signal(false);
  readonly eventLimit = signal(4);
  private readonly clock = inject(EventClock);
  readonly suggestions = computed(() => {
    const candidates = [
      'Jazz',
      'Koncerty dla dzieci',
      'Zwiedzanie',
      'Wystawy',
      'Koncerty w weekend',
      'Bezpłatnie',
      ...this.store
        .events()
        .flatMap((e) => [
          e.category,
          ...(e.details?.works ?? []).map((w) => w.composer ?? ''),
          ...(e.details?.performers ?? []).map((p) => p.name),
        ]),
    ];
    const q = this.query().trim();
    return [...new Set(candidates.filter(Boolean))]
      .filter((s) => !q || textSearchScore(s, q) > 0)
      .filter((s) => s.toLocaleLowerCase('pl') !== q.toLocaleLowerCase('pl'))
      .slice(0, 6);
  });
  readonly pages = [
    {
      title: 'Orkiestra Symfoniczna — skład i artyści',
      text: 'Muzycy dyrektor instrumenty koncertmistrz biografie',
      url: '/orkiestra',
    },
    {
      title: 'Budynek Filharmonii',
      text: 'Architektura Barozzi Veiga sale akustyka',
      url: '/budynek',
    },
    {
      title: 'Historia Filharmonii',
      text: 'Konzerthaus 1948 1953 2014 historia orkiestry',
      url: '/historia',
    },
    {
      title: 'Strefa mediów',
      text: 'Prasa rzecznik zdjęcia logotyp materiały prasowe',
      url: '/media',
    },
    {
      title: 'Kontakt',
      text: 'Adres telefon email kasa bilety sekretariat godziny otwarcia',
      url: '/kontakt',
    },
    {
      title: 'Deklaracja dostępności',
      text: 'Dostępność cyfrowa architektoniczna WCAG pomoc bariery',
      url: '/dostepnosc',
    },
    {
      title: 'Dla edukacji',
      text: 'Szkoły uczelnie grupy szkolne warsztaty edukacja zwiedzanie z uczniami',
      url: '/edukacja',
    },
    {
      title: 'Dla biznesu',
      text: 'Wynajem sal konferencje partnerstwo marketing współpraca firm',
      url: '/biznes',
    },
    {
      title: 'O Filharmonii — muzyka, architektura, historia',
      text: 'Orkiestra, historia Filharmonii, sztuka i budynek',
      url: '/odkryj',
    },
    {
      title: 'Zaplanuj wizytę',
      text: 'Dojazd adres parking szatnia dostępność pierwsza wizyta kontakt',
      url: '/wizyta',
    },
    {
      title: 'Kalendarz wydarzeń',
      text: 'Koncerty, wystawy, zwiedzanie, edukacja, festiwale',
      url: '/kalendarz',
    },
    {
      title: 'Konto Filharmonii Szczecińskiej',
      text: 'Logowanie rejestracja hasło szkoły ulubione profil bilety historia zakupów powiadomienia',
      url: '/konto',
    },
    {
      title: 'Znajdź swoje brzmienie',
      text: 'Muzyczny quiz rekomendacje dla ciebie',
      url: '/dla-ciebie',
    },
  ];
  readonly results = computed(() => {
    const query = this.query().trim();
    const catalogue = this.store
      .events()
      .filter((e) => this.includePast() || !isPastEvent(e, this.clock.now()));
    const events = searchEvents(this.store.events(), query, this.includePast(), this.clock.now());
    const records = [
      ...this.pages.map((p) => ({
        title: p.title,
        text: p.text,
        url: p.url,
        kind: 'Informacja',
        score: textSearchScore(p.title + ' ' + p.text, query),
      })),
      ...[
        ...new Map(
          catalogue.flatMap((e) => e.details?.performers ?? []).map((p) => [p.id, p]),
        ).values(),
      ]
        .filter((p) => p.id)
        .map((p) => ({
          title: p.name,
          text: p.role || 'Profil artysty',
          url: '/artysta/' + p.id,
          kind: 'Artysta',
          score: textSearchScore([p.name, p.role, p.biography].join(' '), query),
        })),
      ...[
        ...new Map(
          catalogue.flatMap((e) => e.details?.articles ?? []).map((a) => [a.id, a]),
        ).values(),
      ]
        .filter((a) => a.id)
        .map((a) => ({
          title: a.title,
          text: (a.text ?? '').slice(0, 180),
          url: '/artykul/' + a.id,
          kind: 'Artykuł',
          score: textSearchScore([a.title, a.text, ...(a.tags ?? [])].join(' '), query),
        })),
      ...events.map((e, i) => ({
        title: e.title,
        text: e.date.split('-').reverse().join('.') + ' · ' + e.time + ' · ' + e.room,
        url: '/wydarzenie/' + e.id,
        kind: isPastEvent(e, this.clock.now()) ? 'Wydarzenie archiwalne' : 'Wydarzenie',
        score: 10 - i / Math.max(events.length, 1),
      })),
    ]
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
    return {
      events,
      records: records.slice(0, 4),
      information: records.filter((r) => !r.kind.startsWith('Wydarzenie')).slice(0, 4),
      textCount: records.length,
      count: records.filter((r) => !r.kind.startsWith('Wydarzenie')).length + events.length,
    };
  });
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.query.set(p.get('q') ?? '');
      this.submitted.set(!!p.get('q')?.trim());
      this.previewOpen.set(false);
      this.includePast.set(p.get('past') === '1');
      this.eventLimit.set(4);
    });
  }
  search(value: string): void {
    this.query.set(value);
    this.submitted.set(false);
    this.previewOpen.set(!!value.trim());
    this.eventLimit.set(4);
  }
  submit(value = this.query()): void {
    this.query.set(value);
    this.submitted.set(!!value.trim());
    this.previewOpen.set(false);
    this.eventLimit.set(4);
    this.updateUrl();
  }
  @HostListener('document:click', ['$event'])
  closePreview(event: MouseEvent): void {
    if (!(event.target as HTMLElement)?.closest('.search-box')) this.previewOpen.set(false);
  }
  showMore(): void {
    this.eventLimit.update((limit) => limit + 4);
  }
  togglePast(value: boolean): void {
    this.includePast.set(value);
    this.eventLimit.set(4);
    if (this.submitted()) this.updateUrl();
  }
  private updateUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.query().trim() || null, past: this.includePast() ? '1' : null },
      replaceUrl: true,
    });
  }
}
