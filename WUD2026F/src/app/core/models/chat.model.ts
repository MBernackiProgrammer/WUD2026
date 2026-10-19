import { Concert } from './concert.model';

export interface ChatEvent {
  event: Concert;
  reason: string;
  insight: string;
  detailUrl: string;
  ticketUrl: string | null;
  googleCalendarUrl: string | null;
  calendarPath: string | null;
}

export interface ChatMessage {
  id: string;
  user: boolean;
  text: string;
  events: ChatEvent[];
  followUps: string[];
}

export interface ChatSessionResponse {
  sessionId: string;
  token: string | null;
  turn: number;
  expiresAt: string;
  messages: ChatMessage[];
}
