import { Routes } from '@angular/router';
export const routes: Routes = [
  {
    path: 'edukacja',
    data: { audience: 'education' },
    loadComponent: () =>
      import('./features/audience/audience.component').then((m) => m.AudienceComponent),
    title: 'Dla edukacji — Filharmonia Szczecińska',
  },
  {
    path: 'biznes',
    data: { audience: 'business' },
    loadComponent: () =>
      import('./features/audience/audience.component').then((m) => m.AudienceComponent),
    title: 'Dla biznesu — Filharmonia Szczecińska',
  },
  {
    path: 'kalendarz',
    data: { catalogSection: 'all' },
    loadComponent: () =>
      import('./features/repertoire/repertoire.component').then((m) => m.RepertoireComponent),
    title: 'Kalendarz — Filharmonia w Szczecinie',
  },
  {
    path: 'szukaj',
    loadComponent: () =>
      import('./features/search/search.component').then((m) => m.SearchComponent),
    title: 'Wyszukaj — Filharmonia w Szczecinie',
  },
  {
    path: 'artysta/:id',
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
    title: 'Artysta — Filharmonia w Szczecinie',
  },
  {
    path: 'artykul/:id',
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
    title: 'Artykuł — Filharmonia w Szczecinie',
  },
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
    title: 'Filharmonia Szczecińska zaprasza',
  },
  {
    path: 'repertuar',
    data: { catalogSection: 'repertoire' },
    loadComponent: () =>
      import('./features/repertoire/repertoire.component').then((m) => m.RepertoireComponent),
    title: 'Repertuar — Filharmonia w Szczecinie',
  },
  {
    path: 'wydarzenia',
    data: { catalogSection: 'events' },
    loadComponent: () =>
      import('./features/repertoire/repertoire.component').then((m) => m.RepertoireComponent),
    title: 'Wydarzenia — Filharmonia w Szczecinie',
  },
  {
    path: 'wydarzenie/:id',
    loadComponent: () => import('./features/event/event.component').then((m) => m.EventComponent),
    title: 'Wydarzenie — Filharmonia w Szczecinie',
  },
  {
    path: 'dla-ciebie',
    loadComponent: () => import('./features/quiz/quiz.component').then((m) => m.QuizComponent),
    title: 'Znajdź swoje brzmienie — Filharmonia w Szczecinie',
  },
  {
    path: 'wizyta',
    loadComponent: () => import('./features/visit/visit.component').then((m) => m.VisitComponent),
    title: 'Zaplanuj wizytę — Filharmonia w Szczecinie',
  },
  {
    path: 'odkryj',
    loadComponent: () =>
      import('./features/discover/discover.component').then((m) => m.DiscoverComponent),
    title: 'Odkryj Filharmonię — Szczecin',
  },
  {
    path: 'konto',
    loadComponent: () =>
      import('./features/account/account.component').then((m) => m.AccountComponent),
    title: 'Konto Filharmonii Szczecińskiej',
  },
  {
    path: 'asystent',
    loadComponent: () =>
      import('./features/assistant/assistant.component').then((m) => m.AssistantComponent),
    title: 'Przewodnik — Filharmonia w Szczecinie',
  },
  {
    path: 'orkiestra',
    data: { page: 'orkiestra' },
    loadComponent: () =>
      import('./features/institution/orchestra.component').then((m) => m.OrchestraComponent),
    title: 'Orkiestra Symfoniczna — Filharmonia Szczecińska',
  },
  {
    path: 'budynek',
    data: { page: 'budynek' },
    loadComponent: () =>
      import('./features/institution/institution.component').then((m) => m.InstitutionComponent),
    title: 'Budynek — Filharmonia Szczecińska',
  },
  {
    path: 'historia',
    data: { page: 'historia' },
    loadComponent: () =>
      import('./features/institution/institution.component').then((m) => m.InstitutionComponent),
    title: 'Historia — Filharmonia Szczecińska',
  },
  {
    path: 'media',
    data: { page: 'media' },
    loadComponent: () =>
      import('./features/institution/institution.component').then((m) => m.InstitutionComponent),
    title: 'Strefa mediów — Filharmonia Szczecińska',
  },
  {
    path: 'kontakt',
    data: { page: 'kontakt' },
    loadComponent: () =>
      import('./features/institution/institution.component').then((m) => m.InstitutionComponent),
    title: 'Kontakt — Filharmonia Szczecińska',
  },
  {
    path: 'dostepnosc',
    data: { page: 'dostepnosc' },
    loadComponent: () =>
      import('./features/institution/institution.component').then((m) => m.InstitutionComponent),
    title: 'Deklaracja dostępności — Filharmonia Szczecińska',
  },
  { path: '**', redirectTo: '' },
];
