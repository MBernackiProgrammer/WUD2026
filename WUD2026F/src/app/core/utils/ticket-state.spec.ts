import { ticketState } from './ticket-state';

describe('Ticket purchase state', () => {
  it('disables buying without a valid seller URL even if availability was marked available', () => {
    expect(ticketState({ status: 'available', ticketUrl: null })).toEqual({
      url: null,
      canBuy: false,
      label: 'Bilety jeszcze niedostępne',
    });
    expect(ticketState({ status: 'unknown', ticketUrl: 'javascript:alert(1)' }).canBuy).toBeFalse();
  });
  it('disables sold-out events even when a seller URL remains', () => {
    expect(ticketState({ status: 'sold-out', ticketUrl: 'https://example.org/tickets' })).toEqual({
      url: null,
      canBuy: false,
      label: 'Bilety wyprzedane',
    });
  });
  it('allows seller checkout without presenting unknown availability as confirmed', () => {
    const state = ticketState({ status: 'unknown', ticketUrl: 'https://example.org/tickets' });
    expect(state.canBuy).toBeTrue();
    expect(state.label).toBe('Dostępność biletów u sprzedawcy');
  });
  it('retains the last-tickets status for a valid purchase link', () => {
    const state = ticketState({ status: 'last-tickets', ticketUrl: 'https://example.org/tickets' });
    expect(state.canBuy).toBeTrue();
    expect(state.label).toBe('Ostatnie bilety');
  });
});
