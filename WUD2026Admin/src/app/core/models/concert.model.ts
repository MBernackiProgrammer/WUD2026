import { EventDetails } from './event-details.model';
export interface Concert {
  details?: EventDetails;
  id: string;
  title: string;
  subtitle: string;
  category: string;
  tags?: string[];
  date: string;
  time: string;
  duration: number | null;
  room: string;
  price: number | null;
  ticketUrl?: string | null;
  sourceUrl?: string | null;
  image: string;
  mood: string;
  audience: string;
  age: number;
  description: string;
  program: string[];
  artists: string;
  status: 'available' | 'last-tickets' | 'sold-out' | 'unknown';
}
