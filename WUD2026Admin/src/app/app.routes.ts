import { Routes } from '@angular/router';
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/editor/content-editor.component').then(
        (module) => module.ContentEditorComponent,
      ),
    title: 'Panel redakcyjny — Filharmonia w Szczecinie',
  },
  { path: '**', redirectTo: '' },
];
