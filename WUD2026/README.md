# Filharmonia — API, PostgreSQL i kontenery

Konfiguracja operacyjna pochodzi wyłącznie ze środowiska. W repozytorium ani obrazach nie ma haseł, kluczy AI, SMTP lub OAuth. Instrukcja całego systemu: [deploy/README.md](deploy/README.md).

## Lokalnie

```powershell
Copy-Item .env.example .env
# Ustaw POSTGRES_PASSWORD w .env (ignorowany przez Git).
docker compose --profile api up -d --build
```

API domyślnie: http://127.0.0.1:5296, baza Docker: 127.0.0.1:5433. Dla natywnego .NET skopiuj `WUD2026/.env.example` do własnego pliku środowiska, uzupełnij hasło i uruchom:

```powershell
./scripts/Start-Local.ps1 -EnvFile WUD2026/.env
# Jeśli chcesz także uruchomić bazę Compose, dodaj -StartDatabase.
```

Możesz też ustawić zmienne bezpośrednio w powłoce i wykonać `dotnet run --project WUD2026 --no-launch-profile`. Migracje EF korzystają z tych samych zmiennych `Database__*` lub `ConnectionStrings__ContentDatabase`; bez ustawienia połączenia zwracają błąd bez ujawnienia wartości.

Pierwszy administrator: `Identity__BootstrapAdmin__Email` i `Identity__BootstrapAdmin__Password`. Dostęp do panelu wymaga roli Admin i CSRF. Nie ma wspólnego domyślnego hasła. Szczegóły kont: [IDENTITY.md](IDENTITY.md).

## Migracje i import

Przy starcie API stosuje migracje EF i inicjalizuje pustą bazę. Jeśli istnieje App_Data/site-content.json lub Content:FilePath, importuje dokument razem z rewizją, wersjami hero, planem i wydarzeniami. W przeciwnym razie używa Seed/content.json. Plik nie jest zmieniany; opcjonalny import wskazuje zmienna Content__FilePath.

Import zachodzi wyłącznie do pustej bazy. Później PostgreSQL jest jedynym źródłem zapisu i odczytu. Zmiana starego JSON nie aktualizuje bazy; awaria bazy nie przełącza zapisu na plik.

W katalogu projektu WUD2026:

```powershell
dotnet ef migrations list
dotnet ef migrations add NazwaZmiany --output-dir Data/Migrations
dotnet ef database update
dotnet ef migrations script --idempotent --output Data/Migrations/deploy.sql
```

dotnet-ef jest przypięty w dotnet-tools.json. Można wyłączyć automatyczne migracje i stosować sprawdzony deploy.sql osobno. Nie używamy EnsureCreated zamiast migracji.

## Kopie zapasowe

```powershell
.\scripts\Backup-Database.ps1
```

Powstaje binarny dump pg_dump w Backups/. Destination wskazuje inny plik; skrypt nie nadpisuje istniejącej kopii. Binarny plik kopiuje docker compose cp, bez tekstowego potoku PowerShell.

Do przywracania służy pg_restore. Najpierw sprawdź kopię w osobnej bazie. Nie zastępuj aktywnych danych bez świadomego wyboru bazy i kopii. Wykaz zawartości: `pg_restore --list plik.dump`; narzędzie jest dostępne w kontenerze postgres.

## Testy i diagnostyka

```powershell
dotnet build WUD2026.slnx
dotnet test WUD2026.IntegrationTests/WUD2026.IntegrationTests.csproj
dotnet format WUD2026.slnx --verify-no-changes
docker compose ps
docker compose --profile api logs --tail 100 api
```

38 testów integracyjnych używa prawdziwego PostgreSQL w osobnych kontenerach Testcontainers, bez modyfikowania właściwej bazy. Zakres: migracje, import, transakcje, równoczesny start/zapis, harmonogram, worker bez odczytu strony, historia, HTTP odtworzenie hosta API i obsługa błędów sterownika.

GET /health/live sprawdza proces. GET /health/ready sprawdza bazę i zainicjalizowany stan. Brak bazy przy starcie przerywa uruchomienie; awaria po starcie daje niedostępny readiness i kontrolowany błąd 503 dla treści. Worker ponawia sprawdzenie, a harmonogram pozostaje w bazie.

Szczegóły modelu i endpointów: WUD2026/README.md. Kontekst trzech projektów: ../kontekst.md.

## Adres sprzedaży biletów

Każde wydarzenie ma opcjonalne pole ticketUrl (kolumna Events.TicketUrl, varchar(2048), nullable). Migracja AddEventTicketUrl zachowuje istniejące rekordy; początkowe wartości są puste, ponieważ nie przypisano niepotwierdzonych adresów sprzedawców. Link HTTPS wpisuje się w panelu Wydarzenia. API zapisuje go i udostępnia w katalogu oraz danych promowanego wydarzenia. Pusta wartość jest normalizowana do null, a niepoprawne protokoły, dane logowania i białe znaki wewnątrz URL są odrzucane.

Publiczny KUP BILET na karcie i stronie wydarzenia jest zwykłym bezpośrednim odnośnikiem do tego adresu w tej samej karcie przeglądarki, bez dialogu zakupu i bez własnego redirect endpointu. Brak adresu oznacza wejście do szczegółów/informację o braku linku, nie fałszywą sprzedaż. Minione i wyprzedane nie oferują zakupu.

Inicjalizacja została dodatkowo objęta sesyjnym pg_advisory_lock przed odkrywaniem migracji, aby dwa równoczesne starty z kilkoma migracjami nie próbowały dodać tej samej kolumny. Baza musi być wcześniej utworzona (zapewnia to Compose); migracje tworzą schemat i seed wewnątrz niej.


## Kustosz AI — OpenAI i pamięć rozmowy

Integracja korzysta z OpenAI Responses API i domyślnie modelu `gpt-5-mini` (reasoning low, strict JSON schema, `store: false`). Klucz jest odczytywany tylko przez API. Plik `WUD2026/appsettings.Local.json` jest ignorowany przez Git oraz wyłączony z obrazu/publikacji; Compose montuje go jako plik tylko do odczytu. Uzupełnij lokalnie:

```json
{
  "Ai": {
    "ApiKey": "TU_WPISZ_KLUCZ_OPENAI"
  }
}
```

Następnie uruchom `docker compose --profile api up -d --build api`. Przy późniejszej zmianie pliku można zrestartować API: `docker compose --profile api restart api`. Domyślne ustawienia w appsettings.json: Ai:Model=gpt-5-mini, MaxOutputTokens=4000, SessionDays=7, MaxTurns=50. Proces uruchamiany bezpośrednio obsługuje także Ai__ApiKey lub OPENAI_API_KEY; Compose nie przekazuje automatycznie zmiennych powłoki do kontenera. Nie umieszczaj klucza w Angularze ani w treści kontekstu projektu. GET /api/chat/status zwraca wyłącznie configured, nigdy klucz.

Brak klucza lub awaria dostawcy daje kontrolowany błąd 503. Nie ma regułowej odpowiedzi udającej AI. W ostatniej weryfikacji klucz nie był ustawiony: testy połączenia z rzeczywistym OpenAI wymagają jego uzupełnienia. Testy modelu używają kontrolowanego HttpMessageHandler, a testy UI kontrolowanych odpowiedzi rozmowy; nie dowodzą jakości odpowiedzi żywego modelu.

### Kontekst i rekomendacje

ChatSessions przechowuje skrót SHA-256 losowego tokena, pamięć zainteresowań, numer tury, termin ważności i dzierżawę przetwarzania. ChatTurns przechowuje pytania, odpowiedzi, uporządkowane rekomendacje, podpowiedzi odpowiedzi użytkownika i rewizję katalogu. Token jest zwracany tylko przy tworzeniu; przeglądarka zapisuje lokalnie wyłącznie identyfikator i token. Historia i pamięć są w PostgreSQL. Oba interfejsy (okno i /asystent) używają jednego AssistantService i tej samej rozmowy.

Model otrzymuje systemową rolę kulturalnego kustosza, podsumowanie preferencji, osiem ostatnich tur i aktualny opublikowany przyszły repertuar. Katalog ma limit 60 kandydatów, wybieranych po wcześniejszych rekomendacjach i zgodności słów z pytaniem/pamięcią; to wyszukiwanie leksykalne, bez bazy wektorowej i bez pobierania internetu. Przy większej ofercie model zna informację o niepełnym podzbiorze. Pierwsza odpowiedź rozpoczyna rozmowę o preferencjach i nie zawiera rekomendacji. Kolejne pytania zbierają gust, towarzyszy (wiek dziecka), termin i budżet bez ponownego pytania o znane informacje. Odpowiedź po poznaniu preferencji zawiera najwyżej jedną rekomendację: ID, uzasadnienie i ciekawostkę; ID muszą istnieć w przekazanym katalogu. Daty, ceny i akcje kart pochodzą z bazy, nie z wygenerowanych URL. Przed zapisem ponownie sprawdzana jest publikacja i termin. Odtworzenie rozmowy odświeża dane i linki; wycofane wydarzenie znika z kart, minione/wyprzedane tracą zakup.

Zapis ma idempotency requestId i expectedTurn. Dzierżawa 90 s zapobiega równoległym odpowiedziom dla jednej sesji; transakcja z blokadą rekordu finalizuje odpowiedź i pamięć razem. Czekanie na OpenAI nie trzyma transakcji. Timeout dostawcy 45 s, frontendu 65 s. Limit wiadomości 2000 znaków, sesji domyślnie 50 tur i 7 dni od utworzenia. Worker co godzinę usuwa wygasłe sesje wraz z turami. „Nowa rozmowa” usuwa dane po stronie API i czyści lokalne poświadczenia. Nie jest to historia powiązana z kontem użytkownika ani synchronizacja między urządzeniami.

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



## Produkcja HTTPS

Gotowy zestaw wdrożeniowy: compose.production.yaml i deploy/README.md. Jedna domena obsługuje frontend SSR, /api, /admin/ i callbacki OAuth /signin-*. Frontend produkcyjny nie używa portów deweloperskich. Trwałe wolumeny przechowują PostgreSQL, certyfikaty i klucze Identity. Sekrety produkcyjne w deploy/appsettings.production.local.json montowanym jako appsettings.Production.json; nie trafiają do obrazu. Nie uruchamiaj starego compose.yaml jako produkcji, bo jest środowiskiem developerskim z dawną bazą filharmonia. Przed przeniesieniem danych wykonaj aktualną kopię WUD2027 i przywróć do pustego wolumenu zgodnie z instrukcją.



Rozszerzony model wydarzeń, panel redakcyjny, podstrony, filtry i nawigacja: [WYDARZENIA.md](WYDARZENIA.md).
