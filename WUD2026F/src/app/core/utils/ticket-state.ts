import { Concert } from '../models/concert.model';
import { ticketUrl } from './ticket-url';

/** Availability and a navigable seller link are independent pieces of information. */
export function ticketState(event: Pick<Concert, 'status' | 'ticketUrl'> | undefined) {
  const url = ticketUrl(event?.ticketUrl);
  if (event?.status === 'sold-out') {
    return { url: null, canBuy: false, label: 'Bilety wyprzedane' };
  }
  if (!url) {
    return { url: null, canBuy: false, label: 'Bilety jeszcze niedostępne' };
  }
  return {
    url,
    canBuy: true,
    label:
      event?.status === 'last-tickets'
        ? 'Ostatnie bilety'
        : event?.status === 'available'
          ? 'Bilety dostępne'
          : 'Dostępność biletów u sprzedawcy',
  };
}
