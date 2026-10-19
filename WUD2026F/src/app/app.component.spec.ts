import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AppComponent } from './app.component';
import { PhilharmonicStore } from './core/services/philharmonic.store';
import { QuizComponent } from './features/quiz/quiz.component';
describe('Filharmonia', () => {
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-17T12:00:00Z'));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        provideNoopAnimations(),
      ],
    });
  });
  afterEach(() => jasmine.clock().uninstall());
  it('shows the navigation landmark and skip link', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.skip-link')?.getAttribute('href')).toBe('#main');
    expect(el.querySelector('nav[aria-label="Nawigacja dolna"]')).toBeTruthy();
  });
  it('excludes recommendations outside the selected child age and budget', () => {
    const fixture = TestBed.createComponent(QuizComponent);
    const quiz = fixture.componentInstance;
    quiz.answers.set(['Z dzieckiem', 'Dowolny termin', 'Jazz', 'Relaksu', 'Do 30 zł']);
    quiz.childAge.set(5);
    expect(
      quiz
        .recommendations()
        .every(
          (event) =>
            event.audience === 'Rodziny' &&
            event.age <= 5 &&
            event.price !== null &&
            event.price <= 30,
        ),
    ).toBeTrue();
    expect(quiz.recommendations().length).toBe(1);
  });
  it('does not replace an empty free-event result with paid events', () => {
    const fixture = TestBed.createComponent(QuizComponent);
    const quiz = fixture.componentInstance;
    quiz.answers.set(['', 'Dowolny termin', '', '', 'Bezpłatnie']);
    expect(quiz.recommendations()).toEqual([]);
  });
  it('does not allow anonymous visitors to save favorites', () => {
    const store = TestBed.inject(PhilharmonicStore);
    store.toggleFavorite('male-wielkie-dzwieki');
    expect(store.canFavorite()).toBeFalse();
    expect(store.favorites()).toEqual([]);
  });
});
