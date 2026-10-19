import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { DEFAULT_HERO } from './core/data/default-hero';
import { ContentDocument } from './core/models/content-document.model';
import { ContentEditorService } from './core/services/content-editor.service';
import { ContentEditorComponent } from './features/editor/content-editor.component';

const document: ContentDocument = {
  revision: 1,
  updatedAt: '2026-10-17T18:00:00Z',
  draftHero: DEFAULT_HERO,
  publishedHero: DEFAULT_HERO,
  scheduledHero: null,
  heroPublishAt: null,
  events: [],
};

describe('Hero editor', () => {
  let api: jasmine.SpyObj<ContentEditorService>;
  beforeEach(() => {
    api = jasmine.createSpyObj<ContentEditorService>('ContentEditorService', [
      'load',
      'saveHero',
      'publishHero',
    ]);
    api.load.and.returnValue(of(structuredClone(document)));
    TestBed.configureTestingModule({
      providers: [
        { provide: ContentEditorService, useValue: api },
        MessageService,
        provideNoopAnimations(),
      ],
    });
  });

  it('requires saving changes before publication', () => {
    const editor = TestBed.createComponent(ContentEditorComponent).componentInstance;
    expect(editor.canPublish).toBeTrue();
    editor.heroForm.controls.title.setValue('Nowy nagłówek');
    editor.heroForm.markAsDirty();
    expect(editor.canPublish).toBeFalse();
    editor.publishHero(false);
    expect(api.publishHero).not.toHaveBeenCalled();
  });

  it('keeps edited content when a stale revision is rejected', () => {
    const editor = TestBed.createComponent(ContentEditorComponent).componentInstance;
    api.saveHero.and.returnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { message: 'Nowsza wersja treści' } }),
      ),
    );
    editor.heroForm.controls.title.setValue('Mój szkic');
    editor.heroForm.markAsDirty();
    editor.saveHero();
    expect(editor.heroForm.controls.title.value).toBe('Mój szkic');
    expect(editor.heroForm.dirty).toBeTrue();
    expect(editor.error()).toBe('Nowsza wersja treści');
    expect(editor.busy()).toBeFalse();
  });

  it('saves the draft without publishing it', () => {
    const editor = TestBed.createComponent(ContentEditorComponent).componentInstance;
    const hero = { ...DEFAULT_HERO, title: 'Zapisany szkic' };
    api.saveHero.and.returnValue(of({ ...document, revision: 2, draftHero: hero }));
    editor.heroForm.patchValue(hero);
    editor.heroForm.markAsDirty();
    editor.saveHero();
    expect(editor.heroForm.pristine).toBeTrue();
    expect(editor.content()?.publishedHero.title).toBe(DEFAULT_HERO.title);
    expect(api.publishHero).not.toHaveBeenCalled();
  });
});
