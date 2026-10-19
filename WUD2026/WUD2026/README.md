# Content API Filharmonii

> Ustawienia uruchomieniowe wyłącznie w zmiennych środowiskowych. Instrukcja i przykłady: ../deploy/README.md.

Uruchomienie, konfiguracja i backup: ../README.md. EF Core 10.0.13, Npgsql.EntityFrameworkCore.PostgreSQL 10.0.3, PostgreSQL 17.

## Model danych

| Tabela | Rola |
| --- | --- |
| Events | Wydarzenia, date/time, cena decimal, program text[], stan i termin publikacji |
| HeroVersions | draft, published i scheduled; FK promowanego wydarzenia |
| SiteState | Rekord id=1: globalna rewizja, czas UTC, termin hero |
| ContentRevisions | Rewizja, czas UTC, operacja i pełny snapshot JSONB |
| __EFMigrationsHistory | Historia migracji EF |

Indeksy: data/godzina, kategoria/data, stan/termin publikacji, termin hero i czas rewizji. Baza wymusza klucze, FK, dozwolone stany i zakresy ceny/wieku/długości. Modele HTTP: Models/ContentModels.cs. Encje i mapowanie: Data/.

Każda operacja blokuje SiteState przez SELECT FOR UPDATE przed odczytem zależnych danych. Porównanie revision, zapis i audyt odbywają się w jednej transakcji. Dwie instancje nie nadpiszą tej samej rewizji. Dodatkowy token EF chroni SiteState. Błąd cofa także rewizję i historię.

## Publikacja

PublicationWorker sprawdza bazę co sekundę i publikuje należne hero/wydarzenia bez otwartej strony. Po przestoju wykonuje zaległe terminy. Odczyty także obsługują należne publikacje. Kilka workerów jest bezpiecznych dzięki blokadzie PostgreSQL.

Hero jest zaplanowanym snapshotem niezależnym od późniejszego szkicu. Publikacja przenosi go do published, czyści plan i zwiększa rewizję. Wydarzenie scheduled staje się published, a publishAt jest czyszczone. Należne zmiany mogą zostać zapisane pod jedną rewizją publication.due.

Jeśli podczas zapisu redaktora nadszedł termin, system utrwala publikację, a nieaktualnemu żądaniu zwraca 409. Terminy są UTC/timestamptz; panel konwertuje Europe/Warsaw. Data i godzina samego wydarzenia są lokalnymi osobnymi wartościami.

## Endpoints

| Metoda | Ścieżka | Kontrakt |
| --- | --- | --- |
| GET | /api/events | Opublikowany katalog, sortowanie data/godzina |
| GET | /api/homepage | hero, featuredEvent, revision, updatedAt |
| GET | /api/admin/content | Pełny dokument |
| GET | /api/admin/homepage-preview | Zapisany szkic |
| PUT | /api/admin/hero | {revision, hero}: zapis szkicu |
| POST | /api/admin/hero/publish | {revision, publishAt}: null=teraz, przyszły termin=plan |
| DELETE | /api/admin/hero/schedule?revision=N | Anulowanie planu |
| PUT | /api/admin/events/{id} | {revision, event}: dodanie/aktualizacja |
| GET | /api/admin/history?limit=20&beforeRevision=N | Historia, limit 1–100 |
| GET | /api/admin/history/{revision} | Snapshot; brak automatycznego rollbacku |
| GET | /health/live | Liveness |
| GET | /health/ready | Readiness PostgreSQL |

Błędy: 400 walidacja, 409 konflikt, 503 niedostępność bazy/zapisu, z message. Szczegóły bazy trafiają do logów. Cache-Control no-store, propagowany CancellationToken, bez logowania wrażliwych wartości EF.

Szkic nie publikuje. Promowane wydarzenie musi być widoczne najpóźniej w terminie hero. Nie można wycofać publikacji wydarzenia używanego przez aktualne/zaplanowane hero. Id w URL i body musi być identyczne. Walidacja długości, adresów, dat i zakresów pozostaje aktywna.

## Dostęp i import

Administracja wymaga zalogowanego konta w roli Admin i tokena CSRF. CORS i publiczny adres konta ustawia środowisko; w produkcji wspólna domena obsługuje /api i /admin/.

DatabaseInitializer stosuje migracje i importuje wyłącznie do pustej bazy. Równoczesny start chronią blokada migracji EF i transakcyjny advisory lock seedowania. Priorytet: Content:FilePath lub App_Data/site-content.json, następnie Seed/content.json. Plik jest zachowany i później nie uczestniczy w zapisie/odczycie.

Historia: content.import-json, content.seed, hero.draft.save, hero.publish, hero.schedule.cancel, event.save, publication.due. Bez identyfikatora redaktora, ponieważ uwierzytelniania jeszcze nie ma.

Testy używają rzeczywistego PostgreSQL w osobnych kontenerach, nie EF InMemory. Źródła: [Npgsql](https://www.npgsql.org/efcore/), [migracje EF](https://learn.microsoft.com/ef/core/managing-schemas/migrations/), [współbieżność EF](https://learn.microsoft.com/ef/core/saving/concurrency).

EventContent.ticketUrl / Events.TicketUrl: opcjonalny adres HTTPS do sprzedawcy, do 2048 znaków, bez danych logowania. Zwracany w API, edytowany przez istniejący PUT wydarzenia, rejestrowany w snapshotach. Brak pola w starym JSON pozostaje null. Migracja AddEventTicketUrl jest niedestrukcyjna dla istniejących danych. Całą inicjalizację, także discovery migracji, chroni sesyjny advisory lock.


## Kustosz AI — OpenAI i pamięć rozmowy

Klucz AI jest odczytywany wyłącznie przez API ze zmiennej `Ai__ApiKey` lub `OPENAI_API_KEY`. Model, limit odpowiedzi i czas sesji konfiguruje się odpowiednimi zmiennymi `Ai__*`; Compose mapuje `AI_MODEL`, `AI_MAX_OUTPUT_TOKENS`, `AI_SESSION_DAYS` i `AI_MAX_TURNS`. Bez klucza `/api/chat/status` zwraca configured=false. Nie montujemy ani nie odczytujemy lokalnych plików appsettings. Pełne mapowanie: ../deploy/.env.example.

### API rozmowy

| Metoda | Ścieżka | Zachowanie |
| --- | --- | --- |
| GET | /api/chat/status | Boolean configured |
| POST | /api/chat/sessions | Tworzy sesję; zwraca sessionId, token, turn, expiresAt, messages |
| GET | /api/chat/sessions/{id} | Odtwarza historię; Authorization: Bearer token |
| POST | /api/chat/sessions/{id}/messages | Bearer; {requestId: UUID, expectedTurn: int, text: string}; zwraca aktualną historię |
| DELETE | /api/chat/sessions/{id} | Bearer; usuwa sesję i tury; 204 |
| GET | /api/events/{id}/calendar.ics | Publiczny załącznik ICS opublikowanego wydarzenia |

Grupa chat: 60 żądań/minutę na IP, bez kolejki, 429 po przekroczeniu. Statusy: 400 błędna wiadomość, 401 błędny token, 410 wygasła sesja, 409 nieaktualna tura/zmiana katalogu/limit długości, 422 odmowa lub błędny termin DST, 502 niepoprawna odpowiedź modelu, 503 brak konfiguracji/awaria/timeout. Nie loguje się kluczy, promptów ani odpowiedzi dostawcy. `store:false` wyłącza przechowywanie stanu Responses do kolejnych tur; nie stanowi deklaracji Zero Data Retention dostawcy.

### Bilety i kalendarze

KUP BILET jest bezpośrednim linkiem HTTPS do Events.TicketUrl, dostępnym tylko dla przyszłego niewyprzedanego wydarzenia. Brak linku daje szczegóły. Płatność pozostaje u sprzedawcy; bot nie zbiera danych karty ani nie potwierdza zakupu.

Google Calendar otwiera formularz nowego wydarzenia w nowej karcie. Apple/Outlook/pozostałe kalendarze korzystają z załącznika ICS. Początek i koniec wyliczane są z terminu Europe/Warsaw i długości wydarzenia, eksportowane jako UTC z obsługą czasu letniego/zimowego. ICS ma stały UID, escaping i składanie linii do 75 bajtów UTF-8. Użytkownik sam zatwierdza dodanie; aplikacja nie ma OAuth, nie zapisuje bezpośrednio do konta i nie twierdzi, że wydarzenie już zapisano.

Źródła implementacji: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [gpt-5-mini](https://developers.openai.com/api/docs/models/gpt-5-mini).


## Import oficjalnego repertuaru do WUD2027

17.10.2026 pobrano wszystkie opublikowane terminy z bieżącego kalendarza sezonu: **261 terminów, 01.10.2026–19.06.2027**, z 103 stron szczegółowych. Przejrzano 12 miesięcy 2026-10–2027-09; lipiec–wrzesień były puste. Liczby miesięczne: październik 70, listopad 43, grudzień 43, styczeń 29, luty 13, marzec 20, kwiecień 24, maj 6, czerwiec 13. To zakres oferty udostępniony w dniu pobrania, bez importu całego historycznego archiwum wcześniejszych sezonów.

Dane źródłowe: https://filharmonia.szczecin.pl/repertuar . Publiczny kalendarz ładuje miesiące przez `/update_box_fs_calendar_next.php?lang=pl&y=YYYY&m=MM`. Szczegóły wydarzeń są pod `/wydarzenia/{id}-...`, a informacje o koncertach zewnętrznych w miesięcznych aktualnościach. Cenniki i linki dla konkretnych dat pochodzą z publicznego popupu `/update_box_indexpopup.php?lang=pl&event_id=ID`; dopasowanie następuje po dacie i godzinie, nie po samym tytule. Nie dokonuje się rezerwacji ani zakupu podczas pobierania.

Artefakt `Imports/official-repertoire-2026-10.json` zawiera source, fetchedAt UTC, zakres miesięcy, komplet wydarzeń, mapę oryginalnych URL zdjęć i warnings. Każdy termin ma stabilne ID `fs-{data-dateid}` z oficjalnego kalendarza oraz własny sourceUrl. Powtarzające się koncerty, wystawy i tury zwiedzania pozostają osobnymi terminami. Pobrano 102 unikatowe fotografie do WUD2026F/public/images/official-{hash}.{extension}; oryginalne źródła są w artefakcie. Koncerty zewnętrzne bez osobnej fotografii zachowują ogólną fotografię budynku. Nie kopiowano całych opisów redakcyjnych: opis w aplikacji składa się z rodzaju wydarzenia, faktycznego programu i wykonawców; pełny opis jest dostępny przez odnośnik do źródła.

W bazie dodano 261 wpisów, zachowując 6 istniejących i ustawienia hero: łącznie 267 opublikowanych rekordów. Aktualna rewizja po imporcie i doprecyzowaniu informacji ze stron szczegółowych: 4. Audyt zapisuje operację `repertoire.official-import`. Nie usuwano starych demonstracyjnych rekordów, nie zmieniano promowanego hero. 161 terminów ma dokładny HTTPS URL sprzedaży; zachowano query i identyfikatory terminu. Nie przypisano losowych linków do pozostałych. Dla zewnętrznych koncertów akceptowano wskazany w źródle bezpośredni adres HTTPS do wydarzenia, nie wymyślano adresu na podstawie nazwy ani nie podmieniano HTTP na HTTPS bez potwierdzenia. Status pozostaje unknown, chyba że źródło jednoznacznie stwierdza wyprzedanie; sam działający link nie dowodzi wolnych miejsc.

Cena i czas trwania są teraz nullable: 17 terminów nie ma podanej ceny, 114 nie ma podanego czasu. Null nie oznacza 0 zł ani 90 minut. UI pokazuje cenę/czas do potwierdzenia lub pomija nieznaną długość na kartach. Filtry budżetu i kreator nie uznają nieznanej ceny za bezpłatną ani mieszczącą się w limicie. Zera oznaczają jawnie podany bezpłatny wstęp/cennik. Artystów i szczegółowego programu nie dopowiadano, gdy nie było ich w źródle. Pełny rodzaj wydarzenia jest brany ze strony szczegółowej (kalendarz AJAX ma skrócone etykiety); dzięki temu 76 terminów edukacyjnych jest w Dla rodzin. Wiek minimalny pochodzi wyłącznie z jawnego opisu; w frontendzie matchesChildAge respektuje też jawne pasma „od 1. do 2.” ze subtitle, aby starsze dzieci nie dostawały propozycji warsztatów dla młodszych.

### Ponowny import

W katalogu rozwiązania, przy dostępnym Pythonie i PostgreSQL WUD2027:

```powershell
python -m pip install -r scripts/import-requirements.txt
python scripts/fetch-repertoire.py --start 2026-10 --months 12 --output Imports/official-repertoire-2026-10.json --images ../WUD2026F/public/images --refresh
dotnet run --project WUD2026 --no-launch-profile -- --Import:File=../Imports/official-repertoire-2026-10.json
```

`--refresh` odświeża cache stron; bez tej flagi cache jest ponownie wykorzystywany. Skrypt nie zapisuje do bazy. Skrypt pobierający nie przekazuje żadnych kluczy ani haseł do zewnętrznej witryny. Ma timeouty, ponowienia i odstęp 150 ms między nowymi pobraniami. Import do bazy jest osobnym, świadomym poleceniem CLI, bez nowego publicznego endpointu administracyjnego i bez automatycznego harmonogramu synchronizacji.

OfficialRepertoireImporter waliduje cały plik przed zapisem, pilnuje oficjalnego źródła i unikatowych ID, a następnie zapisuje zmienione wydarzenia w jednej transakcji przez IContentStore.UpdateAsync z kontrolą revision. Błąd jednego wpisu blokuje całą operację. Import aktualizuje istniejące ID ze źródła, dodaje nowe i zachowuje obce wpisy. Ponowne wykonanie identycznego pliku nie tworzy rekordów ani rewizji. Porównanie liczb jest wartościowe (decimal 50 == 50.00), a programu po zawartości, nie po referencji tablicy. Świadomy ponowny import może nadpisać ręczne zmiany tych samych ID; nie ma automatycznego usuwania wydarzeń znikających ze źródła. Konfiguracja DB pochodzi z appsettings.json/środowiska; docelowo WUD2027 na 5432. Polecenie CLI po zakończeniu wychodzi i nie uruchamia serwera ani workerów. Nie uruchamiaj zwykłego API dwa razy na 5296.

### Zmiany techniczne

EventContent/ContentEvent: Price decimal?, Duration int?, SourceUrl nullable varchar(2048). ContentMapping zachowuje źródło obustronnie. Dwie migracje: `20261017205846_AddOfficialRepertoireMetadata` i `20261017210147_ExpandOfficialArtists` (Artists z 500 do 2000 znaków, aby nie ucinać rzeczywistej obsady). Obie zastosowano do WUD2027; deploy.sql odświeżono. Nie wykonuj automatycznego downgrade schematu na bazie z nieznanymi cenami/długościami — wcześniejszy schemat ich nie reprezentuje.

Oba Angularowe Concert mają price/duration nullable i opcjonalny sourceUrl. Publiczne karty, szczegóły, hero i karty czatu obsługują brak danych. Szczegóły oficjalnych wpisów pokazują oryginalny sourceUrl. Bezpłatne mają Wstęp wolny, brak cennika Cena do potwierdzenia/Sprawdź cenę. Dla oficjalnych rekordów eksport ze szczegółów jest bezpośrednim odnośnikiem do backendowego calendar.ics, bez etykiety DEMO. Backend ICS pomija DTEND, jeśli długość jest nieznana; Google ma wtedy punktowe dates start/start, bez wymyślonego czasu zakończenia. Instrukcje kustosza wyjaśniają znaczenie null i zakaz potwierdzania budżetu przy nieznanej cenie.

Rozszerzono kategorie w obu aplikacjach o Wystawy, Recitale, Muzyka świata, Koncerty zewnętrzne i Inne. Admin zachowuje sourceUrl przy ręcznej edycji, dopuszcza puste price/duration i pokazuje zaimportowane pliki fotografii w selekcie; obie wartości numeryczne nadal mają walidację zakresów dla podanych liczb. Limit wykonawców i maxlength to 2000. Nie zmieniano logowania, uprawnień, logo ani układu nawigacji.

### Kopia i weryfikacja

Przed migracjami/importem wykonano pełny pg_dump formatu custom z WUD2027: `Backups/WUD2027-before-repertoire-20261017-225902.dump` (18419 bajtów). Kopia dotyczy właściwej natywnej bazy na 5432, nie starego Dockera filharmonia. Nie drukowano ani nie kopiowano danych dostępowych do dokumentacji.

41 testów API przeszło (m.in. atomowość importu, powtórne wykonanie, aktualizacja bez duplikatów, brak zmiany obcych rekordów, nullable roundtrip, pełna obsada >500 znaków, odrzucenie innego źródła, ICS bez zmyślonego końca). Po korekcie porównania skali decimal ponownie przeszły dwa testy importu, w tym powtórka po cenie 70 zapisanej jako numeric(10,2). Publiczny frontend: 24 testy, admin: 9 testów, wszystkie przechodzą. Produkcyjne buildy obu aplikacji przechodzą ze znanymi warningami budżetu (~844kB publiczny, ~519kB admin). Formatowanie zmienionych frontendowych plików zgodne z Prettier.

Pełny ponowny import w WUD2027 zwrócił „Official repertoire unchanged: 261 terms. No revision written”. API odczytuje 267 unikatowych ID; snapshot wszystkich 261 oficjalnych wpisów został porównany pole po polu z publicznym API. Fotografie dostępne lokalnie, odnośniki biletowe pochodzą z bazy. Testy UI nie wykonują zakupów, zapisów kalendarza na konto ani zmian w rzeczywistej treści.


## Repertuar i Wydarzenia — wspólna tabela, osobne tagi

17.10.2026 użytkownik rozdzielił ofertę na dwie zakładki. `/repertuar` pokazuje koncerty, recitale i spektakle muzyczne. `/wydarzenia` pokazuje zwiedzanie, wystawy, warsztaty, wykłady, dyskusje i pozostałą ofertę niekoncertową. Warsztaty muzyczne są wydarzeniami, a koncerty/spektakle dla dzieci pozostają repertuarem. Istniejąca kategoria Dla rodzin może występować w obu zakładkach.

Nie tworzono dwóch tabel. Jedna kolumna **Events.Tags text[] NOT NULL** przechowuje dokładnie jeden tag katalogu: `repertoire` albo `events`. Mogą współistnieć dodatkowe tagi redakcyjne. Walidacja API: do 20 niepustych, niepowtarzających się tagów, do 60 znaków każdy; nie można podać obu tagów katalogu ani samych tagów dodatkowych. Pusta tablica u starych klientów/seedów jest zgodnościowo uzupełniana przez EventTags.Normalize na podstawie rodzaju wydarzenia. Jawny poprawny tag jest nadrzędny względem kategorii — jego zmiana nie powoduje zmiany kategorii ani kopiowania rekordu.

Migracja **20261017212543_AddCatalogTags** dodaje wyłącznie kolumnę w Events i jednorazowo uzupełnia wszystkie istniejące wpisy. Reguła startowa: Warsztat* oraz Zwiedzanie/Wystawy → events; kategorie muzyczne i Dla rodzin poza warsztatami → repertoire; pozostałe Koncert*/Recital*/Spektakl muzyczny* → repertoire; reszta → events. Identyczna reguła jest w Models/EventTags.cs i scripts/fetch-repertoire.py. Po migracji WUD2027: **267 rekordów = 124 repertoire + 143 events**, bez wspólnych/nieoznaczonych rekordów. Liczba wierszy, ID, ceny, URL biletów, hero i historyczne rewizje są zachowane. Rewizja CMS pozostaje 4; dodanie tagów odnotowuje historia migracji. Dawne snapshoty audytu sprzed tej migracji naturalnie nie zawierają tagów. Zwykłe kolejne zapisy panelu zapisują tagi w rewizji event.save.

ContentMapping mapuje tagi w obie strony. API /api/events nadal zwraca jeden pełny katalog z tags; rozdzielenie widoków wykonuje frontend na podstawie tagów, bez heurystyki kategorii. Publiczny i administracyjny Concert mają opcjonalne tags dla zgodności dawnych danych. Offline CONCERTS, serwerowe seed/legacy JSON oraz Imports/official-repertoire-2026-10.json zostały uzupełnione o tagi. OfficialRepertoireImporter normalizuje brakujące tagi i porównuje Tags oraz Program po zawartości tablic, zachowując idempotencję. Ponowienie oficjalnego importu po migracji zwróciło unchanged:261, bez rewizji i bez duplikatów. Nowe pobranie zapisuje te same tagi do artefaktu. Świadomy reimport pozostaje aktualizacją pól źródłowych i może nadpisać ręczne zmiany dla tego samego ID, jak wcześniej.

Panel admina ma pole **Zakładka w serwisie** (event-section), niezależne od kategorii. Można wybrać Repertuar — koncerty i muzyka albo Wydarzenia — zwiedzanie, wystawy i warsztaty. Domyślnie nowy wpis to Repertuar. Edycja odczytuje istniejący tag i przy zapisie zmienia wyłącznie tag katalogu, zachowując inne tagi oraz sourceUrl. Brak mechanizmu push do już otwartego publicznego klienta: po edycji odśwież widok publiczny, aby pobrał aktualny katalog.

Obie trasy używają jednego RepertoireComponent z data.catalogSection i niezależnymi query params. Zestaw kategorii jest wyliczany z rekordów wybranej zakładki, a reset pozostaje na właściwej trasie. Zachowano wyszukiwanie, daty, filtry, sticky scroller/miesiąc i automatyczny scroll do najbliższego terminu. Widok wydarzeń ma własny nagłówek, opis, placeholder i nagłówek miesiąca. /odkryj prowadzi do /wydarzenia?category=Zwiedzanie. Szczegóły nadal mają wspólny adres /wydarzenie/:id i wracają do katalogu zgodnego z tagiem. Kreator koncertów /dla-ciebie wyklucza tags=events, nawet gdy kategoria pasuje do preferencji muzycznej. Kustosz otrzymuje tags i opis obu zakładek; może rekomendować obie części oferty.

Dolna nawigacja ma teraz cztery pozycje: **Główna, Repertuar, Wydarzenia, Konto melomana**. Desktop również ma link Wydarzenia. Aktywny katalog i jego szczegóły podświetlają tę samą złotą ikonę. AppComponent.activeCatalogSection śledzi NavigationEnd i tag aktualnego wydarzenia; dla Repertuar/Wydarzenia w dolnym pasku używa bezpośredniego class.active oraz aria-current, bez konfliktu z równoległym RouterLinkActive. Główna/Konto zachowują RouterLinkActive. Logo, języki i przycisk AI niezmienione.

### Stabilne dane SSR

Podczas weryfikacji ujawniono możliwość dublowania kart w trakcie hydratacji: serwer renderował 267 rekordów, a przeglądarka zaczynała od sześciu fixtures i asynchronicznego odczytu. PhilharmonicStore przekazuje teraz publiczny katalog przez Angular TransferState (`philharmonic-catalog`). Pierwszy render klienta używa dokładnie danych serwera; dopiero afterNextRender odświeża API. TransferState obejmuje wyłącznie publiczne wydarzenia, nie czaty, poświadczenia, klucze ani historię użytkownika. W przypadku braku API zachowane pozostaje wcześniejsze zachowanie awaryjnego katalogu. Dodatkowy test potwierdza odtworzenie dokładnych danych i tagów przed odświeżeniem.

### Weryfikacja i uruchomienie

Przed zmianą wykonano pełny backup natywnego WUD2027: `Backups/WUD2027-before-catalog-tags-20261017-232611.dump` (116537 bajtów). Nowa migracja jest zastosowana, deploy.sql odświeżony. API działa na dotychczasowym porcie 5296; health/ready Healthy. Nie uruchamiano starego kontenerowego API wskazującego filharmonia.

Przeszło 51 testów API, w tym 10 nowych przypadków klasyfikacji, migracji z już zapełnionej tabeli, zachowania ręcznego tagu i dodatkowych tagów, walidacji i roundtripu PostgreSQL. Admin: 9 testów przeszło. Testy UI Chromium potwierdziły dokładny podział wszystkich ID bez duplikatów, listy miesięczne obu tras, cztery pozycje mobile, właściwą aktywną ikonę także na szczegółach, powroty do odpowiedniej trasy i sticky sterowanie. Szerokości 360/390/768/1024/1440 bez overflow i błędów JS. Zmiana tagu w formularzu admina została sprawdzona przez przechwycenie samego PUT w teście UI (zachowane category/sourceUrl); testy backendu osobno potwierdzają zapis w prawdziwym PostgreSQL. Test UI nie modyfikował rzeczywistej bazy; revision=4 i 267 rekordów pozostało. Oba buildy produkcyjne przechodzą z dotychczasowymi ostrzeżeniami bundla.


## Identity — aktualne uprawnienia

Od 18.10.2026 zarządzanie wymaga sesji ASP.NET Core Identity w roli Admin i CSRF. Dawne opisy braku logowania lub dostępu wyłącznie na podstawie loopback są historyczne. Pełna konfiguracja znajduje się w ../IDENTITY.md. Publiczna strona Konto melomana obsługuje logowanie i zarządzanie kontami User/Admin/School.

