import { Concert } from '../models/concert.model';
import { normalize, matchesDate } from './event-filters';
import { isPastEvent } from './event-time';

const STOP = new Set([
  'szukam',
  'szukaj',
  'pokaz',
  'chce',
  'najblizsze',
  'najblizszy',
  'najblizszych',
  'wydarzenia',
  'wydarzen',
  'wydarzenie',
  'koncert',
  'koncerty',
  'koncertow',
  'dla',
  'na',
  'w',
  'i',
  'z',
  'do',
  'mi',
  'mnie',
  'sie',
  'cos',
  'jakies',
  'prosze',
  'czy',
  'jest',
]);
const GROUPS = [
  ['jazz', 'jazzowy', 'jazzowe', 'jazzowych', 'jazzu', 'jazzowa', 'jaz'],
  [
    'dzieci',
    'dziecka',
    'dzieckiem',
    'dziecku',
    'dzieciece',
    'rodziny',
    'rodzinne',
    'rodzinny',
    'rodzina',
    'rodzin',
  ],
  ['szkoly', 'szkol', 'szkolne', 'szkolny', 'uczniow', 'uczniowie', 'klasa'],
  ['zwiedzanie', 'zwiedzania', 'zwiedzic', 'architektura', 'budynek'],
  ['wystawa', 'wystawy', 'wystawe', 'wystaw', 'galeria', 'galerii', 'wernisaz'],
  ['festiwal', 'festiwale', 'festiwalu', 'festiwalowe'],
  ['symfoniczny', 'symfoniczne', 'symfonicznych', 'orkiestrowy', 'orkiestrowe'],
  ['kameralny', 'kameralne', 'kameralnych'],
  ['fortepian', 'fortepianowy', 'fortepianowe', 'pianino'],
  ['skrzypce', 'skrzypcowy', 'skrzypcowe'],
  ['dojazd', 'dojechac', 'dotrzec', 'parking', 'adres', 'mapa'],
  ['biznes', 'biznesu', 'wynajem', 'wynajac', 'konferencja'],
];
const canonical = (word: string) => GROUPS.find((group) => group.includes(word))?.[0] ?? word;
const words = (text: string): string[] => normalize(text).match(/[a-z0-9]+/g) ?? [];
const MONTHS = [
  ['styczen', 'styczniu', 'stycznia'],
  ['luty', 'lutym', 'lutego'],
  ['marzec', 'marcu', 'marca'],
  ['kwiecien', 'kwietniu', 'kwietnia'],
  ['maj', 'maju', 'maja'],
  ['czerwiec', 'czerwcu', 'czerwca'],
  ['lipiec', 'lipcu', 'lipca'],
  ['sierpien', 'sierpniu', 'sierpnia'],
  ['wrzesien', 'wrzesniu', 'wrzesnia'],
  ['pazdziernik', 'pazdzierniku', 'pazdziernika'],
  ['listopad', 'listopadzie', 'listopada'],
  ['grudzien', 'grudniu', 'grudnia'],
];
function monthOf(word: string): number | null {
  let index = MONTHS.findIndex((forms) => forms.includes(word));
  if (index >= 0) return index + 1;
  if (word.length < 5) return null;
  const candidates = MONTHS.map((forms, index) => ({
    month: index + 1,
    score: Math.min(
      ...forms.map((form) => {
        const d = Array.from({ length: word.length + 1 }, () => Array(form.length + 1).fill(0));
        for (let i = 0; i <= word.length; i++) d[i][0] = i;
        for (let j = 0; j <= form.length; j++) d[0][j] = j;
        for (let i = 1; i <= word.length; i++)
          for (let j = 1; j <= form.length; j++) {
            d[i][j] = Math.min(
              d[i - 1][j] + 1,
              d[i][j - 1] + 1,
              d[i - 1][j - 1] + Number(word[i - 1] !== form[j - 1]),
            );
            if (i > 1 && j > 1 && word[i - 1] === form[j - 2] && word[i - 2] === form[j - 1])
              d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
          }
        return d[word.length][form.length];
      }),
    ),
  })).sort((a, b) => a.score - b.score);
  return candidates[0].score <= (word.length >= 7 ? 2 : 1) &&
    candidates[0].score < candidates[1].score
    ? candidates[0].month
    : null;
}

function near(a: string, b: string): boolean {
  if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const differences = [...a].map((c, i) => (c === b[i] ? -1 : i)).filter((i) => i >= 0);
    return (
      differences.length === 1 ||
      (differences.length === 2 &&
        differences[1] === differences[0] + 1 &&
        a[differences[0]] === b[differences[1]] &&
        a[differences[1]] === b[differences[0]])
    );
  }
  const short = a.length < b.length ? a : b,
    long = a.length < b.length ? b : a;
  let i = 0,
    j = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
    } else {
      j++;
      if (j - i > 1) return false;
    }
  }
  return true;
}

export function searchIntent(query: string) {
  const all = words(query);
  const monthTokens = all
    .map((word) => ({ word, month: monthOf(word) }))
    .filter((item) => item.month !== null);
  const month = monthTokens[0]?.month ?? null;
  const yearToken = all.find((word) => /^(20\d{2})$/.test(word));
  const period = all.some((w) => ['dzis', 'dzisiaj'].includes(w))
    ? 'today'
    : all.includes('jutro')
      ? 'tomorrow'
      : all.includes('weekend')
        ? 'weekend'
        : all.some((w) => ['tydzien', 'tygodniu'].includes(w))
          ? 'week'
          : all.some((w) => ['miesiac', 'miesiacu'].includes(w))
            ? 'month'
            : '';
  const ignored = new Set([
    'dzis',
    'dzisiaj',
    'jutro',
    'weekend',
    'ten',
    'tym',
    'tydzien',
    'tygodniu',
    'miesiac',
    'miesiacu',
  ]);
  const free = all.some((w) => ['bezplatnie', 'darmowe', 'darmo', 'bezplatne'].includes(w));
  const ageMatch = normalize(query).match(/(?:dzieck\w*\s+)?(\d{1,2})\s*(?:lat|lata|letni|letnie)/);
  const tokens = [
    ...new Set(
      all
        .filter(
          (w) =>
            !STOP.has(w) &&
            !ignored.has(w) &&
            !monthTokens.some((item) => item.word === w) &&
            ![
              'bezplatnie',
              'darmowe',
              'darmo',
              'bezplatne',
              'lat',
              'lata',
              'letni',
              'letnie',
            ].includes(w) &&
            !/^\d+$/.test(w),
        )
        .map(canonical),
    ),
  ];
  return {
    tokens,
    period,
    month,
    year: yearToken ? Number(yearToken) : null,
    free,
    age: ageMatch ? Number(ageMatch[1]) : null,
    query: normalize(query).trim(),
  };
}

export function textSearchScore(text: string, query: string): number {
  const intent = searchIntent(query);
  if (!intent.tokens.length) return 0;
  const hay = words(text).map(canonical);
  let score = 0;
  for (const token of intent.tokens) {
    if (hay.includes(token)) score += 10;
    else if (hay.some((word) => token.length >= 3 && word.startsWith(token))) score += 6;
    else if (hay.some((word) => near(token, word))) score += 3;
    else return 0;
  }
  return score + (normalize(text).includes(intent.query) ? 10 : 0);
}

export function searchEvents(
  events: Concert[],
  query: string,
  includePast: boolean,
  now: Date,
): Concert[] {
  if (!query.trim()) return [];
  const intent = searchIntent(query);
  return events
    .filter((e) => includePast || !isPastEvent(e, now))
    .filter((e) => !intent.period || matchesDate(e, intent.period))
    .filter((e) => intent.month === null || Number(e.date.slice(5, 7)) === intent.month)
    .filter((e) => intent.year === null || Number(e.date.slice(0, 4)) === intent.year)
    .filter((e) => !intent.free || e.price === 0)
    .filter(
      (e) =>
        intent.age === null ||
        (['Dzieci', 'Rodziny', 'Szkoły', 'Młodzież'].includes(e.audience) &&
          intent.age >= e.age &&
          (e.details?.ageMax == null || intent.age <= e.details.ageMax)),
    )
    .map((event) => {
      const primary = [
        event.title,
        event.category,
        event.artists,
        event.audience,
        event.mood,
        ...(event.tags ?? []),
        event.details?.collection?.name,
        ...(event.details?.performers ?? []).map((p) => p.name),
        ...(event.details?.works ?? []).flatMap((w) => [w.title, w.composer]),
      ].join(' ');
      const full = [
        primary,
        event.subtitle,
        event.description,
        event.room,
        ...event.program,
        event.details?.whyAttend,
        event.details?.exhibition?.curator,
        event.details?.education?.benefits,
      ].join(' ');
      const score = intent.tokens.length ? textSearchScore(full, query) : 1;
      return {
        event,
        score: score > 0 ? score + textSearchScore(primary, query) : 0,
        past: isPastEvent(event, now),
      };
    })
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        Number(a.past) - Number(b.past) ||
        (a.past
          ? (b.event.date + b.event.time).localeCompare(a.event.date + a.event.time)
          : (a.event.date + a.event.time).localeCompare(b.event.date + b.event.time)) ||
        b.score - a.score ||
        a.event.id.localeCompare(b.event.id),
    )
    .map((x) => x.event);
}
