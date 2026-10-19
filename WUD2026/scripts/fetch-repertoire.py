"""Fetch the official public calendar into a reviewable, deterministic import file.

pip install -r scripts/import-requirements.txt
python scripts/fetch-repertoire.py --start 2026-10 --months 12 --output repertoire.json --images ../WUD2026F/public/images
No database writes. Cache avoids repeated downloads; --refresh updates cached pages.
"""
import argparse
import hashlib
import json
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

BASE = 'https://filharmonia.szczecin.pl'


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def text(node):
    return clean(node.get_text(' ', strip=True)) if node else ''


def key(value):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', value.lower()).encode('ascii', 'ignore').decode())


def money(value):
    prices = re.findall(r'(\d+(?:[,.]\d{1,2})?)\s*zł', value, re.I)
    return min((float(p.replace(',', '.')) for p in prices), default=None)


def category(offer):
    lower = offer.lower()
    for token, label in [('zwiedz', 'Zwiedzanie'), ('wystaw', 'Wystawy'), ('wernisa', 'Wystawy'), ('dzieci', 'Dla rodzin'), ('uczni', 'Dla rodzin'), ('symfon', 'Symfoniczne'), ('jazz', 'Jazz'), ('kameral', 'Kameralne'), ('recital', 'Recitale'), ('świata', 'Muzyka świata'), ('zewnętrz', 'Koncerty zewnętrzne')]:
        if token in lower:
            return label
    return 'Inne'


def catalog_tag(offer):
    label = category(offer)
    if offer.lower().startswith('warsztat') or label in ['Zwiedzanie', 'Wystawy']:
        return 'events'
    if label in ['Symfoniczne', 'Kameralne', 'Jazz', 'Filmowe', 'Recitale', 'Muzyka świata', 'Koncerty zewnętrzne', 'Dla rodzin']:
        return 'repertoire'
    return 'repertoire' if offer.lower().startswith(('koncert', 'recital', 'spektakl muzyczny')) else 'events'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--start', required=True)
    parser.add_argument('--months', type=int, default=12)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--images', type=Path, required=True)
    parser.add_argument('--cache', type=Path, default=Path('.import-cache'))
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args()
    if not 1 <= args.months <= 24:
        parser.error('months must be between 1 and 24')
    args.cache.mkdir(parents=True, exist_ok=True)
    args.images.mkdir(parents=True, exist_ok=True)
    warnings, coverage = [], []

    def fetch(url):
        if urlparse(url).hostname != 'filharmonia.szczecin.pl':
            raise ValueError('Unexpected source host')
        file = args.cache / (hashlib.sha256(url.encode()).hexdigest() + '.html')
        if args.refresh or not file.exists():
            for attempt in range(3):
                try:
                    with urlopen(Request(url, headers={'User-Agent': 'FilharmoniaProjectImport/1.0'}), timeout=30) as response:
                        raw = response.read(5_000_000).decode('utf-8')
                    file.write_text(raw, encoding='utf-8')
                    time.sleep(.15)
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    time.sleep(1 + attempt)
        return BeautifulSoup(file.read_text(encoding='utf-8'), 'html.parser')

    year, month = map(int, args.start.split('-'))
    rows = {}
    for offset in range(args.months):
        index = year * 12 + month - 1 + offset
        y, m = index // 12, index % 12 + 1
        url = f'{BASE}/update_box_fs_calendar_next.php?lang=pl&y={y}&m={m}'
        soup = fetch(url)
        entries = soup.select('.event[data-dateid]')
        coverage.append({'month': f'{y}-{m:02}', 'count': len(entries), 'url': url})
        for entry in entries:
            anchor = entry.select_one('.info a') or entry.select_one('a[href]')
            if not anchor:
                raise ValueError('Calendar entry has no source link')
            stamp = entry.select_one('time[datetime]')
            if stamp:
                date_time = datetime.fromisoformat(stamp['datetime'])
                date, hour = date_time.strftime('%Y-%m-%d'), date_time.strftime('%H:%M')
            else:
                hour_match = re.search(r'\b(\d{1,2}:\d{2})\b', text(entry))
                if not hour_match:
                    raise ValueError('Calendar entry has no time')
                date, hour = f'{y}-{m:02}-{int(entry["data-d"]):02}', hour_match.group(1).zfill(5)
            identity = 'fs-' + entry['data-dateid']
            external = 'event_ext' in entry.get('class', [])
            row = {'id': identity, 'date': date, 'time': hour, 'title': text(anchor), 'sourceUrl': urljoin(BASE, anchor['href']), 'offer': text(entry.select_one('.offer')) or ('Koncert zewnętrzny' if external else 'Wydarzenie'), 'external': external}
            if identity in rows and rows[identity] != row:
                raise ValueError('Conflicting source date ID ' + identity)
            rows[identity] = row
        print(f'{y}-{m:02}: {len(entries)} terms', flush=True)

    events, image_sources = [], {}
    for number, row in enumerate(rows.values(), 1):
        source = fetch(row['sourceUrl'])
        programme = [text(li) for li in source.select('.programme_programme li')]
        artists = ', '.join(text(li) for li in source.select('.programme_people li'))
        room = text(source.select_one('.place'))
        duration_text = text(source.select_one('.programme_description')) + ' ' + text(source.select_one('.description'))
        duration_match = re.search(r'(?:czas trwania[^\d]{0,50}|wycieczka trwa (?:około )?)(\d+)\s*min', duration_text, re.I)
        duration = int(duration_match.group(1)) if duration_match else None
        price, ticket, status = None, None, 'unknown'
        extra = ''
        offer = row['offer'] if row['external'] else text(source.select_one('.offer')) or row['offer']
        if row['external']:
            # Monthly news groups external concerts under individual h2 headings.
            matched = None
            for heading in source.select('.news_text_more h2'):
                if key(text(heading)) == key(row['title']):
                    matched = heading
                    break
            if matched:
                fragment = []
                for sibling in matched.next_siblings:
                    if getattr(sibling, 'name', None) == 'h2':
                        break
                    fragment.append(str(sibling))
                section = BeautifulSoup(''.join(fragment), 'html.parser')
                section_text = text(section)
                price_match = re.search(r'Bilety w cenach:(.*?)(?:Bilety dostępne:|Kontakt|$)', section_text, re.I)
                price = money(price_match.group(1)) if price_match else None
                if 'sold out' in section_text.lower() or 'wyprzedan' in section_text.lower():
                    status = 'sold-out'
                # Prefer an explicit event URL; do not turn a seller's homepage into a fabricated event link.
                candidates = [a['href'] for a in section.select('a[href^="https://"]') if urlparse(a['href']).path not in ['', '/']]
                ticket = candidates[0] if candidates else None
            else:
                warnings.append({'id': row['id'], 'warning': 'External concert details not matched; retained calendar facts only'})
            programme, artists, duration, room = [], '', None, ''
        else:
            event_match = re.search(r'/wydarzenia/(\d+)', row['sourceUrl'])
            if not event_match:
                raise ValueError('Unknown detail URL ' + row['sourceUrl'])
            cashbox = fetch(f'{BASE}/update_box_indexpopup.php?lang=pl&event_id={event_match.group(1)}')
            for term in cashbox.select('.cashbox_event'):
                term_time = term.select_one('time[datetime]')
                if not term_time:
                    continue
                dt = datetime.fromisoformat(term_time['datetime'])
                if dt.strftime('%Y-%m-%d %H:%M') != row['date'] + ' ' + row['time']:
                    continue
                term_text = text(term)
                price = money(' '.join(text(table) for table in term.select('table')))
                if re.search(r'wstęp (?:wolny|bezpłatny)|bezpłatne|bezpłatny', term_text, re.I):
                    price = 0
                buy = next((a for a in term.select('a[href^="https://"]') if text(a).upper() in ['BILETY', 'KUP BILET', 'KUP BILETY']), None)
                ticket = buy['href'] if buy else None
                if re.search(r'wyprzedan|sold out|brak (?:wolnych )?(?:miejsc|biletów)', term_text, re.I):
                    status = 'sold-out'
                break
        image = 'building-3.jpg'
        image_meta = source.select_one('meta[property="og:image"]')
        if image_meta and not row['external']:
            url = urljoin(BASE, image_meta['content'])
            extension = Path(urlparse(url).path).suffix.lower()
            if urlparse(url).hostname == 'filharmonia.szczecin.pl' and extension in ['.jpg', '.jpeg', '.png', '.webp']:
                image = 'official-' + hashlib.sha256(url.encode()).hexdigest()[:16] + extension
                image_sources[image] = url
                path = args.images / image
                if not path.exists():
                    with urlopen(Request(url, headers={'User-Agent': 'FilharmoniaProjectImport/1.0'}), timeout=30) as response:
                        path.write_bytes(response.read(10_000_000))
                    time.sleep(.15)
        age_match = re.search(r'(?:wiek(?:u)? dziecka|wieku|od)\s*(\d+)', offer, re.I)
        audience = 'Rodziny' if category(offer) == 'Dla rodzin' else 'Seniorzy' if 'senior' in offer.lower() else 'Nie podano ograniczeń wiekowych'
        description = offer + '.'
        if programme:
            description += ' W programie: ' + '; '.join(programme) + '.'
        if artists:
            description += ' Wykonawcy: ' + artists + '.'
        description += ' Szczegółowe informacje udostępnia organizator na oficjalnej stronie wydarzenia.'
        if len(row['title']) > 150 or len(artists) > 2000 or len(description) > 5000:
            raise ValueError('Source data exceeds model limits: ' + row['id'] + ' lengths=' + str((len(row['title']), len(artists), len(description))))
        events.append({k: row[k] for k in ['id', 'title', 'date', 'time', 'sourceUrl']} | {
            'subtitle': offer[:250], 'category': category(offer), 'tags': [catalog_tag(offer)], 'duration': duration, 'room': room or 'Filharmonia w Szczecinie',
            'price': price, 'ticketUrl': ticket, 'image': image, 'mood': 'Nie określono', 'audience': audience, 'age': int(age_match.group(1)) if age_match else 0,
            'description': description, 'program': programme, 'artists': artists or 'Wykonawcy nie zostali podani przez organizatora.', 'status': status, 'publicationState': 'published', 'publishAt': None})
        if number % 20 == 0:
            print(f'Details {number}/{len(rows)}', flush=True)
    events.sort(key=lambda event: (event['date'], event['time'], event['id']))
    result = {'source': BASE + '/repertuar', 'fetchedAt': datetime.now(timezone.utc).isoformat(), 'coverage': coverage, 'events': events, 'images': image_sources, 'warnings': warnings}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'events': len(events), 'images': len(image_sources), 'ticketLinks': sum(e['ticketUrl'] is not None for e in events), 'unknownPrices': sum(e['price'] is None for e in events), 'unknownDurations': sum(e['duration'] is None for e in events), 'warnings': len(warnings)}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
