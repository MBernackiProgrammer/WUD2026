import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONTENT_API_URL } from '../data/content-api';
import { DEFAULT_HERO } from '../data/default-hero';
import { HomeContentService } from './home-content.service';

describe('Editable hero content', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('loads the published hero separately from the editor draft', () => {
    const service = TestBed.inject(HomeContentService);
    service.load(false);
    const request = TestBed.inject(HttpTestingController).expectOne(CONTENT_API_URL + '/homepage');
    request.flush({
      hero: { ...DEFAULT_HERO, title: 'Opublikowany nagłówek' },
      featuredEvent: null,
      revision: 2,
      updatedAt: '2026-10-17T18:00:00Z',
    });
    expect(service.hero().title).toBe('Opublikowany nagłówek');
    expect(service.preview()).toBeFalse();
    expect(service.featuredEvent()).toBeNull();
  });

  it('requests draft content only in explicit preview mode', () => {
    const service = TestBed.inject(HomeContentService);
    service.load(true);
    const request = TestBed.inject(HttpTestingController).expectOne(
      CONTENT_API_URL + '/admin/homepage-preview',
    );
    request.flush({
      hero: { ...DEFAULT_HERO, title: 'Wersja robocza' },
      featuredEvent: null,
      revision: 2,
      updatedAt: '2026-10-17T18:00:00Z',
    });
    expect(service.hero().title).toBe('Wersja robocza');
    expect(service.preview()).toBeTrue();
  });

  it('retains demonstration content and reports a failed draft preview on API failure', () => {
    const service = TestBed.inject(HomeContentService);
    service.load(true);
    TestBed.inject(HttpTestingController)
      .expectOne(CONTENT_API_URL + '/admin/homepage-preview')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.hero()).toEqual(DEFAULT_HERO);
    expect(service.failed()).toBeTrue();
  });
});
