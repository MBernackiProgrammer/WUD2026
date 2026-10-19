import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { CONTENT_API_URL } from '../data/content-api';
import { ContentDocument, EditorEvent } from '../models/content-document.model';
import { HeroContent } from '../models/hero-content.model';

@Injectable({ providedIn: 'root' })
export class ContentEditorService {
  private readonly http = inject(HttpClient);

  load(): Observable<ContentDocument> {
    return this.http.get<ContentDocument>(`${CONTENT_API_URL}/admin/content`).pipe(timeout(8000));
  }

  saveHero(revision: number, hero: HeroContent): Observable<ContentDocument> {
    return this.http
      .put<ContentDocument>(`${CONTENT_API_URL}/admin/hero`, { revision, hero })
      .pipe(timeout(8000));
  }

  publishHero(revision: number, publishAt: string | null): Observable<ContentDocument> {
    return this.http
      .post<ContentDocument>(`${CONTENT_API_URL}/admin/hero/publish`, { revision, publishAt })
      .pipe(timeout(8000));
  }

  cancelHeroSchedule(revision: number): Observable<ContentDocument> {
    return this.http
      .delete<ContentDocument>(`${CONTENT_API_URL}/admin/hero/schedule`, { params: { revision } })
      .pipe(timeout(8000));
  }

  saveEvent(revision: number, event: EditorEvent): Observable<ContentDocument> {
    return this.http
      .put<ContentDocument>(`${CONTENT_API_URL}/admin/events/${encodeURIComponent(event.id)}`, {
        revision,
        event,
      })
      .pipe(timeout(8000));
  }
}
