import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { adminAuthInterceptor } from './core/services/admin-auth.interceptor';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { PhilharmonicPreset } from './core/theme/prime-theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch(), withInterceptors([adminAuthInterceptor])),
    provideRouter(routes),
    provideAnimationsAsync(),
    MessageService,
    providePrimeNG({
      theme: {
        preset: PhilharmonicPreset,
        options: { darkModeSelector: false, cssLayer: { name: 'primeng' } },
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
        emptyMessage: 'Brak wyników',
        emptyFilterMessage: 'Brak pasujących wyników',
        aria: { close: 'Zamknij' },
      },
    }),
  ],
};
