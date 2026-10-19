import { ticketUrl } from './ticket-url';

describe('Ticket seller navigation', () => {
  it('preserves the seller URL including the event path and query parameters', () => {
    const url = 'https://tickets.example.org/koncert/123?source=filharmonia&seat=4';
    expect(ticketUrl(url)).toBe(url);
  });
  it('rejects missing, unsafe and credential-bearing destinations', () => {
    for (const value of [
      null,
      undefined,
      '',
      '/tickets',
      '//example.org',
      'javascript:alert(1)',
      'http://example.org',
      'https://user:secret@example.org',
      'https://example.org/has space',
    ]) {
      expect(ticketUrl(value)).toBeNull();
    }
  });
});
