import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AssistantService } from './assistant.service';
import { CONTENT_API_URL } from '../data/content-api';
import { ChatSessionResponse } from '../models/chat.model';

describe('Persistent curator conversation', () => {
  let service: AssistantService;
  let http: HttpTestingController;
  const id = '00000000-0000-4000-8000-000000000001';
  const token = 'a'.repeat(64);
  const url = CONTENT_API_URL + '/chat/sessions';
  const session = (turn = 0): ChatSessionResponse => ({
    sessionId: id,
    token: turn ? null : token,
    turn,
    expiresAt: '2026-10-24T12:00:00Z',
    messages: turn
      ? [
          {
            id: 'answer',
            user: false,
            text: 'Posłuchajmy jazzu.',
            events: [],
            followUps: ['A kameralistyka?'],
          },
        ]
      : [],
  });
  beforeEach(() => {
    localStorage.removeItem('philharmonic-curator-session');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AssistantService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    localStorage.removeItem('philharmonic-curator-session');
  });

  async function createConversation(): Promise<void> {
    const sending = service.ask('Lubię jazz');
    http.expectOne(url).flush(session());
    await Promise.resolve();
    const request = http.expectOne(url + '/' + id + '/messages');
    expect(request.request.headers.get('Authorization')).toBe('Bearer ' + token);
    expect(request.request.body.expectedTurn).toBe(0);
    request.flush(session(1));
    expect(await sending).toBeTrue();
  }

  it('uses the same private session and turn for a contextual follow-up', async () => {
    await createConversation();
    const sending = service.ask('A coś spokojniejszego?');
    const request = http.expectOne(url + '/' + id + '/messages');
    expect(request.request.body.expectedTurn).toBe(1);
    expect(request.request.body.text).toBe('A coś spokojniejszego?');
    request.flush(session(2));
    expect(await sending).toBeTrue();
    expect(service.followUps()).toEqual(['A kameralistyka?']);
    const saved = JSON.parse(localStorage.getItem('philharmonic-curator-session')!);
    expect(Object.keys(saved).sort()).toEqual(['sessionId', 'token']);
  });

  it('retries the identical request after a network failure without duplicating a turn', async () => {
    await createConversation();
    const sending = service.ask('Opowiedz więcej');
    const failed = http.expectOne(url + '/' + id + '/messages');
    const body = failed.request.body;
    failed.flush({ message: 'Spróbuj ponownie' }, { status: 503, statusText: 'Unavailable' });
    expect(await sending).toBeFalse();
    expect(service.pendingQuestion()).toBe('Opowiedz więcej');
    const retrying = service.retry();
    const retried = http.expectOne(url + '/' + id + '/messages');
    expect(retried.request.body).toEqual(body);
    retried.flush(session(2));
    expect(await retrying).toBeTrue();
    expect(service.pendingQuestion()).toBe('');
  });

  it('deletes history on the server before forgetting local credentials', async () => {
    await createConversation();
    const clearing = service.reset();
    const request = http.expectOne(url + '/' + id);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    expect(await clearing).toBeTrue();
    expect(service.messages()).toEqual([]);
    expect(localStorage.getItem('philharmonic-curator-session')).toBe('');
  });

  it('prevents empty, oversized or duplicate pending messages', async () => {
    expect(await service.ask('   ')).toBeFalse();
    expect(await service.ask('x'.repeat(2001))).toBeFalse();
    const sending = service.ask('Jazz');
    expect(await service.ask('Drugie pytanie')).toBeFalse();
    http.expectOne(url).flush(session());
    await Promise.resolve();
    http.expectOne(url + '/' + id + '/messages').flush(session(1));
    await sending;
  });
});
