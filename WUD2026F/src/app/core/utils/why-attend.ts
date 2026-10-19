import { Concert } from '../models/concert.model';
import { eventArtists } from './event-artists';

/** Editorial fallback uses catalogue facts, never invents works, amenities or access. */
export function whyAttend(event: Concert): string {
  const category = event.category.toLocaleLowerCase('pl');
  const type = event.details?.type;
  const title = `„${event.title.trim()}”`;
  let sentences: string[];
  if (type === 'tour' || category.includes('zwiedzanie')) {
    sentences = [
      `${title} to okazja, by spojrzeć na Filharmonię z perspektywy jej architektury.`,
      'Zamiast skupiać się na koncercie, możesz poświęcić uwagę samemu miejscu i jego detalom.',
      'Wybierz tę wizytę, jeśli chcesz lepiej poznać przestrzeń, do której wrócisz później jako słuchacz.',
    ];
  } else if (type === 'exhibition' || category.includes('wystaw')) {
    sentences = [
      `${title} pozwala odkryć Filharmonię także jako miejsce spotkania ze sztuką wizualną.`,
      'Bezpośredni kontakt z pracami daje możliwość przyjrzenia się ich detalom i zbudowania własnej interpretacji.',
      'To propozycja dla osób, które chcą poszerzyć wizytę w Filharmonii o doświadczenie inne niż koncert.',
    ];
  } else if (category.includes('rodzin') || event.audience === 'Rodziny') {
    sentences = [
      `${title} to propozycja wspólnego odkrywania muzyki przez dzieci i ich opiekunów.`,
      'Spotkanie na żywo zachęca do wsłuchiwania się w brzmienia i dzielenia się własnymi wrażeniami.',
      'Warto przyjść razem, by później wracać do usłyszanych dźwięków i rozmów o muzyce.',
    ];
  } else if (type === 'education') {
    sentences = [
      `${title} to okazja do rozwijania muzycznej ciekawości w ramach spotkania edukacyjnego.`,
      'Bezpośredni kontakt z kulturą pozwala zestawić dotychczasową wiedzę z własnym doświadczeniem.',
      'Wybierz tę propozycję, jeśli chcesz poznawać muzykę poprzez uważne słuchanie i nowe pytania.',
    ];
  } else if (category.includes('jazz')) {
    sentences = [
      `${title} to okazja do spotkania z jazzem wykonywanym na żywo.`,
      'Wsłuchaj się w brzmienie poszczególnych instrumentów i sposób, w jaki muzycy budują wspólną opowieść.',
      'Wybierz ten koncert, jeśli cenisz osobowość wykonawców i chcesz poświęcić wieczór uważnemu słuchaniu.',
    ];
  } else if (category.includes('symfon')) {
    sentences = [
      `${title} zaprasza do odkrywania muzyki symfonicznej w bezpośrednim kontakcie z wykonawcami.`,
      'Na żywo łatwiej śledzić, jak poszczególne grupy instrumentów składają się na brzmienie orkiestry.',
      'To propozycja zarówno na powrót do ulubionego repertuaru, jak i na kolejne muzyczne odkrycie.',
    ];
  } else if (category.includes('kameral') || category.includes('recital')) {
    sentences = [
      `${title} to okazja do uważnego przyjrzenia się interpretacji i brzmieniu wykonawców.`,
      'Muzyka na żywo pozwala wychwycić detale frazowania i wzajemne muzyczne odpowiedzi.',
      'Warto wybrać ten wieczór, jeśli chcesz skupić się na niuansach i indywidualnym głosie artystów.',
    ];
  } else {
    sentences = [
      `${title} to okazja, by przeżyć wydarzenie bezpośrednio, razem z innymi uczestnikami.`,
      'Wspólna obecność pozwala skupić uwagę na tym, co dzieje się tu i teraz.',
      'Wybierz tę propozycję, jeśli szukasz czasu na kulturę i doświadczenia, do którego można wrócić w rozmowie po spotkaniu.',
    ];
  }
  const program =
    event.details?.works?.map((work) => [work.composer, work.title].filter(Boolean).join(' — ')) ||
    [];
  const works = (program.length ? program : event.program).filter(Boolean).slice(0, 2);
  const performers = eventArtists(event)
    .map((p) => p.name)
    .slice(0, 2);
  if (
    works.length &&
    !['tour', 'exhibition'].includes(type || '') &&
    !/wystaw|zwiedzanie/.test(category)
  ) {
    sentences[1] = `Zapowiedziany program obejmuje: ${works.join('; ')}.`;
  } else if (performers.length && !/zwiedzanie/.test(category)) {
    sentences[1] =
      performers.length === 1
        ? `W wydarzeniu bierze udział ${performers[0]}.`
        : `Wśród zapowiedzianych uczestników są ${performers.join(' oraz ')}.`;
  }
  const editorial = event.details?.whyAttend?.trim();
  if (editorial) {
    // Preserve curated copy, shortening only descriptions exceeding the requested length.
    const parts = Array.from(
      new Intl.Segmenter('pl', { granularity: 'sentence' }).segment(editorial),
      (part) => part.segment.trim(),
    ).filter(Boolean);
    const selected = parts
      .slice(0, 4)
      .map((part) => (/[.!?…][”"’]?$/.test(part) ? part : part + '.'));
    while (selected.length < 3) selected.push(sentences[selected.length]);
    return selected.join(' ');
  }
  return sentences.join(' ');
}
