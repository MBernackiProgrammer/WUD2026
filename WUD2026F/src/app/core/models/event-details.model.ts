export interface EventDetails {
  type?: 'concert' | 'cycle' | 'festival' | 'exhibition' | 'education' | 'tour' | 'other';
  endDate?: string | null;
  intermissionMinutes?: number | null;
  priceMax?: number | null;
  ageMax?: number | null;
  whyAttend?: string | null;
  accessibility?: string[];
  accessibilityNotes?: string | null;
  sensoryNotes?: string | null;
  programUrl?: string | null;
  promoted?: boolean;
  promotionPriority?: number;
  venue?: {
    name?: string;
    number?: string;
    address?: string;
    directions?: string;
    planUrl?: string;
    accessibility?: string;
  };
  collection?: {
    name?: string;
    season?: string;
    description?: string;
    passes?: string;
    passUrl?: string;
  };
  exhibition?: {
    title?: string;
    gallery?: string;
    artists?: string;
    curator?: string;
    openingAt?: string;
    photos?: string[];
  };
  education?: {
    group?: string;
    age?: string;
    registration?: string;
    registrationUrl?: string;
    benefits?: string;
  };
  performers?: Artist[];
  works?: { title: string; composer?: string; duration?: number | null; audioUrl?: string }[];
  articles?: Article[];
  faqs?: { question: string; answer: string; category?: string }[];
}
export interface Artist {
  id: string;
  name: string;
  role?: string;
  biography?: string;
  photoUrl?: string;
}
export interface Article {
  id: string;
  title: string;
  text?: string;
  date?: string;
  media?: string[];
  tags?: string[];
}
