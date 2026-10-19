import { TestBed } from '@angular/core/testing';
import { TransferState, makeStateKey } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { PhilharmonicStore } from './philharmonic.store';
import { CONCERTS } from '../data/demo-concerts';
import { Concert } from '../models/concert.model';
import { CONTENT_API_URL } from '../data/content-api';

describe('Hydrated catalogue', () => {
  it('starts with the exact server catalogue before refreshing, preserving editorial tags', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), MessageService],
    });
    const serverEvents: Concert[] = [{ ...CONCERTS[0], id: 'from-database', tags: ['events'] }];
    TestBed.inject(TransferState).set(
      makeStateKey<Concert[]>('philharmonic-catalog'),
      serverEvents,
    );
    const store = TestBed.inject(PhilharmonicStore);
    const http = TestBed.inject(HttpTestingController);
    expect(store.events()).toEqual(serverEvents);
    expect(store.eventsLoading()).toBeFalse();
    http.expectNone(CONTENT_API_URL + '/events');
    store.refreshEvents();
    http
      .expectOne(CONTENT_API_URL + '/events')
      .flush([{ ...serverEvents[0], tags: ['repertoire'] }]);
    expect(store.events()[0].tags).toEqual(['repertoire']);
    http.verify();
  });
});
