import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { PhilharmonicPreset } from './core/theme/prime-theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideClientHydration(withEventReplay()),
    provideAnimationsAsync(),
    MessageService,
    providePrimeNG({
      ripple: true,
      theme: {
        preset: PhilharmonicPreset,
        options: { darkModeSelector: false, cssLayer: { name: 'primeng', order: 'primeng' } },
      },
      translation: {
        firstDayOfWeek: 1,
        dayNames: ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'],
        dayNamesShort: ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'],
        dayNamesMin: ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'],
        today: 'Dzisiaj',
        clear: 'Wyczyść',
        prevMonth: 'Poprzedni miesiąc',
        nextMonth: 'Następny miesiąc',

        monthNames: [
          'styczeń',
          'luty',
          'marzec',
          'kwiecień',
          'maj',
          'czerwiec',
          'lipiec',
          'sierpień',
          'wrzesień',
          'październik',
          'listopad',
          'grudzień',
        ],
        monthNamesShort: [
          'sty',
          'lut',
          'mar',
          'kwi',
          'maj',
          'cze',
          'lip',
          'sie',
          'wrz',
          'paź',
          'lis',
          'gru',
        ],
        chooseYear: 'Wybierz rok',
        chooseMonth: 'Wybierz miesiąc',
        prevYear: 'Poprzedni rok',
        nextYear: 'Następny rok',
        prevDecade: 'Poprzednia dekada',
        nextDecade: 'Następna dekada',
        emptyMessage: 'Brak wyników',
        emptyFilterMessage: 'Brak pasujących wyników',
        selectionMessage: 'Wybrano {0} elementów',
        emptySelectionMessage: 'Nie wybrano elementu',
        aria: {
          close: 'Zamknij',
          previous: 'Poprzedni',
          next: 'Następny',
          firstPageLabel: 'Pierwsza strona',
          lastPageLabel: 'Ostatnia strona',
        },
      },
    }),
  ],
};
