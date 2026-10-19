import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AccountService, AccountUser } from './account.service';
import { CONTENT_API_URL } from '../data/content-api';

describe('Account favorites', () => {
  let service: AccountService;
  let http: HttpTestingController;
  const user: AccountUser = {
    id: 'listener',
    email: 'listener@example.org',
    displayName: 'Listener',
    emailConfirmed: true,
    phoneNumber: null,
    schoolName: '',
    schoolAddress: '',
    createdAt: '',
    roles: ['User'],
    hasPassword: true,
    logins: [],
    favoriteEventIds: [],
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('rejects anonymous changes without any request', async () => {
    expect(await service.toggleFavorite('event')).toBeFalse();
    http.expectNone(CONTENT_API_URL + '/account/csrf');
  });
  it('saves on the authenticated account before showing the heart and clears on logout', async () => {
    service.user.set(structuredClone(user));
    const saved = service.toggleFavorite('event');
    http.expectOne(CONTENT_API_URL + '/account/csrf').flush({ token: 'csrf' });
    await Promise.resolve();
    const request = http.expectOne(CONTENT_API_URL + '/account/favorites');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.headers.get('X-CSRF-TOKEN')).toBe('csrf');
    expect(request.request.body).toEqual({ eventIds: ['event'], userId: 'listener' });
    expect(service.user()?.favoriteEventIds).toEqual([]);
    request.flush({});
    expect(await saved).toBeTrue();
    expect(service.user()?.favoriteEventIds).toEqual(['event']);
    service.user.set(null);
    expect(await service.toggleFavorite('another')).toBeFalse();
  });
  it('does not update another account when the session changes during a save', async () => {
    service.user.set(structuredClone(user));
    const saved = service.toggleFavorite('event');
    http.expectOne(CONTENT_API_URL + '/account/csrf').flush({ token: 'csrf' });
    await Promise.resolve();
    const request = http.expectOne(CONTENT_API_URL + '/account/favorites');
    service.user.set({ ...user, id: 'another-listener', favoriteEventIds: ['their-event'] });
    request.flush({});
    expect(await saved).toBeFalse();
    expect(service.user()?.favoriteEventIds).toEqual(['their-event']);
  });
  it('keeps the saved list unchanged when the API rejects the request', async () => {
    service.user.set(structuredClone(user));
    const pending = service.toggleFavorite('event');
    const rejected = expectAsync(pending).toBeRejected();
    http.expectOne(CONTENT_API_URL + '/account/csrf').flush({ token: 'csrf' });
    await Promise.resolve();
    http
      .expectOne(CONTENT_API_URL + '/account/favorites')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await rejected;
    expect(service.user()?.favoriteEventIds).toEqual([]);
    expect(service.savingFavorite()).toBeFalse();
  });
});
