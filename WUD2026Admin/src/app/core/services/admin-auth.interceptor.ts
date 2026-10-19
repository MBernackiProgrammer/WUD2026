import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap } from 'rxjs';
import { CONTENT_API_URL } from '../data/content-api';

export const adminAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(CONTENT_API_URL + '/admin/')) return next(request);
  const authenticated = request.clone({ withCredentials: true });
  if (request.method === 'GET') return next(authenticated);
  return inject(HttpClient)
    .get<{ token: string }>(CONTENT_API_URL + '/account/csrf', { withCredentials: true })
    .pipe(
      switchMap((csrf) =>
        next(authenticated.clone({ setHeaders: { 'X-CSRF-TOKEN': csrf.token } })),
      ),
    );
};
