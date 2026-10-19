import { eventArtists, artistKey } from './core/utils/event-artists';
import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catalogSection } from './core/utils/catalog-section';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { PhilharmonicStore } from './core/services/philharmonic.store';
import { readStorage, writeStorage } from './core/utils/browser-storage';
import { AssistantWindowComponent } from './shared/components/assistant-window/assistant-window.component';
import { IconComponent } from './shared/components/icon/icon.component';

const LANGUAGE_STORAGE_KEY = 'philharmonic-language';
const LANGUAGE_CODES = ['pl', 'de', 'en', 'uk'];

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    IconComponent,
    FormsModule,
    SelectModule,
    ButtonModule,
    ToastModule,
    AssistantWindowComponent,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly store = inject(PhilharmonicStore);
  private readonly document = inject(DOCUMENT);
  readonly readingSize = signal(0);
  readonly highContrast = signal(false);
  readonly reducedMotion = signal(false);
  private readonly router = inject(Router);
  private readonly navigation = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
  );
  readonly breadcrumbs = computed<{ label: string; url?: string }[]>(() => {
    this.navigation();
    const path = this.router.url.split(/[?#]/)[0];
    if (path === '/') return [];
    const root = { label: 'Główna', url: '/' };
    const labels: Record<string, string> = {
      '/kalendarz': 'Kalendarz',
      '/repertuar': 'Repertuar',
      '/wydarzenia': 'Wydarzenia',
      '/szukaj': 'Wyszukaj',
      '/odkryj': 'O Filharmonii',
      '/orkiestra': 'Orkiestra Symfoniczna',
      '/budynek': 'Budynek',
      '/historia': 'Historia',
      '/media': 'Strefa mediów',
      '/kontakt': 'Kontakt',
      '/dostepnosc': 'Deklaracja dostępności',
      '/wizyta': 'Zaplanuj wizytę',
      '/edukacja': 'Dla edukacji',
      '/biznes': 'Dla biznesu',
      '/konto': 'Konto Filharmonii Szczecińskiej',
      '/dla-ciebie': 'Znajdź swoje brzmienie',
      '/asystent': 'SymfonIA',
    };
    const match = path.match(/^\/(wydarzenie|artysta|artykul)\/([^/]+)$/);
    if (match) {
      const [, type, encodedId] = match;
      let id = encodedId;
      try {
        id = decodeURIComponent(encodedId);
      } catch {
        /* Keep the route value. */
      }
      const events = this.store.events();
      if (type === 'wydarzenie')
        return [
          root,
          { label: 'Kalendarz', url: '/kalendarz' },
          { label: events.find((e) => e.id === id)?.title || 'Wydarzenie' },
        ];
      const label =
        type === 'artysta'
          ? events
              .flatMap(eventArtists)
              .find((a) => a.id === id || 'nazwa-' + artistKey(a.name) === id)?.name || 'Artysta'
          : events.flatMap((e) => e.details?.articles ?? []).find((a) => a.id === id)?.title ||
            'Artykuł';
      return [root, { label: 'O Filharmonii', url: '/odkryj' }, { label }];
    }
    if (['/orkiestra', '/budynek', '/historia'].includes(path))
      return [root, { label: 'O Filharmonii', url: '/odkryj' }, { label: labels[path] }];
    return labels[path] ? [root, { label: labels[path] }] : [];
  });
  readonly activeCatalogSection = computed(() => {
    this.navigation();
    const path = this.router.url.split('?')[0];
    if (path === '/kalendarz') return 'all';
    if (path === '/repertuar') return 'repertoire';
    if (path === '/wydarzenia') return 'events';
    const id = path.match(/^\/wydarzenie\/([^/]+)$/)?.[1];
    const event = this.store.events().find((item) => item.id === id);
    return event ? catalogSection(event) : null;
  });
  readonly language = signal('pl');
  readonly languages = [
    { label: 'Polski', value: 'pl' },
    { label: 'Deutsch', value: 'de' },
    { label: 'English', value: 'en' },
    { label: 'Українська', value: 'uk' },
  ];

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const header = this.document.querySelector<HTMLElement>('.site-header');
      if (header) {
        const updateHeaderHeight = () =>
          this.document.documentElement.style.setProperty(
            '--site-header-height',
            `${header.getBoundingClientRect().height}px`,
          );
        const observer = new ResizeObserver(updateHeaderHeight);
        observer.observe(header);
        updateHeaderHeight();
        destroyRef.onDestroy(() => observer.disconnect());
      }
      const bar = this.document.querySelector<HTMLElement>('.accessibility-bar');
      if (bar) {
        const updateHeight = () =>
          this.document.documentElement.style.setProperty(
            '--accessibility-bar-height',
            `${bar.getBoundingClientRect().height}px`,
          );
        const observer = new ResizeObserver(updateHeight);
        observer.observe(bar);
        updateHeight();
        destroyRef.onDestroy(() => observer.disconnect());
      }
      try {
        const saved = JSON.parse(readStorage('philharmonic-accessibility') || '{}');
        this.readingSize.set([0, 1, 2].includes(saved.size) ? saved.size : 0);
        this.highContrast.set(saved.contrast === true);
        this.reducedMotion.set(saved.motion === true);
      } catch {
        /* Ignore invalid optional preferences. */
      }
      this.applyAccessibility();
      const savedLanguage = readStorage(LANGUAGE_STORAGE_KEY);
      if (savedLanguage && LANGUAGE_CODES.includes(savedLanguage)) {
        this.language.set(savedLanguage);
      }
    });
  }

  changeReadingSize(delta: number): void {
    this.readingSize.update((size) => Math.max(0, Math.min(2, size + delta)));
    this.applyAccessibility();
  }

  toggleContrast(): void {
    this.highContrast.update((value) => !value);
    this.applyAccessibility();
  }

  toggleMotion(): void {
    this.reducedMotion.update((value) => !value);
    this.applyAccessibility();
  }

  skipToContent(event: Event): void {
    event.preventDefault();
    const main = this.document.getElementById('main');
    main?.focus({ preventScroll: true });
    main?.scrollIntoView({ block: 'start' });
  }

  private applyAccessibility(): void {
    const root = this.document.documentElement;
    root.dataset['readingSize'] = String(this.readingSize());
    root.classList.toggle('high-contrast', this.highContrast());
    root.classList.toggle('reduce-motion', this.reducedMotion());
    writeStorage(
      'philharmonic-accessibility',
      JSON.stringify({
        size: this.readingSize(),
        contrast: this.highContrast(),
        motion: this.reducedMotion(),
      }),
    );
  }

  selectLanguage(code: string): void {
    if (!LANGUAGE_CODES.includes(code)) return;

    this.language.set(code);
    writeStorage(LANGUAGE_STORAGE_KEY, code);

    if (code !== 'pl') {
      this.store.notify('Ta wersja językowa jest w przygotowaniu. Zapisaliśmy Twój wybór.');
    }
  }
}
