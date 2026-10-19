# Filharmonia w Szczecinie — prototyp serwisu

Angular 19 z SSR. Pierwszy etap specyfikacji klienta: działające ścieżki użytkownika i wizualny fundament strony. Projekt wykorzystuje istniejący frontend WUD2026F.

## Uruchomienie

```powershell
npm ci
npm start
```

Domyślny adres: http://localhost:4200. Przy wskazywaniu portu bezpośrednio w PowerShell:

```powershell
node node_modules/@angular/cli/bin/ng.js serve --host 127.0.0.1 --port 4200
```

```powershell
npm run build
npm run serve:ssr:WUD2026F
```

Serwer produkcyjny SSR domyślnie działa na porcie 4000.

## Działające widoki

- `/`: strona główna, wybór kategorii i wejścia do głównych ścieżek.
- `/repertuar`: tylko tag repertoire (koncerty i muzyka); wyszukiwanie tekstowe bez wymogu polskich znaków, filtry terminu, kategorii, ceny, wieku dziecka i statusu. Filtry zapisują się w URL. Na telefonie panel filtrów wysuwa się od dołu.
- `/wydarzenie/:id`: informacje o wydarzeniu, program, dostępność jako brak zweryfikowanych danych, ulubione, pobieranie pliku ICS i bezpośrednie przejście do sprzedawcy z pola ticketUrl wydarzenia.
- `/dla-ciebie`: pięć pytań z możliwością pomijania i cofania, zachowanie odpowiedzi, ranking gatunku i nastroju; termin, wiek i cena stanowią ograniczenia.
- `/wizyta`: dojazd i FAQ dla początkujących.
- `/odkryj`: architektura i wejście do terminów zwiedzania.
- `/konto`: ulubione przechowywane lokalnie, bez uwierzytelniania.
- `/asystent`: kustosz OpenAI z pamięcią rozmowy w PostgreSQL, rekomendacjami, biletami i kalendarzami. Wymaga klucza w backendzie.

## Organizacja kodu

```text
src/app/
  core/
    data/         # repertuar demonstracyjny
    models/       # modele domenowe
    services/     # stan aplikacji i klient API kustosza
    theme/        # wspólny preset PrimeNG
    utils/        # filtrowanie, rekomendacje, kalendarz i preferencje
  features/
    home/         # każdy widok ma własny komponent i szablon HTML
    repertoire/
    event/
    quiz/
    visit/
    discover/
    account/
    assistant/
  shared/components/
    brand-symbol/
    event-card/
    icon/
```

Globalne style są podzielone na pliki w `src/styles/`, w tym `pages/` dla poszczególnych widoków. Kolejność ich wczytywania określa `src/styles.scss`. Nadpisania PrimeNG znajdują się w `_primeng.scss`, a przycisk asystenta w `_floating-assistant.scss`.

Komponenty obsługują stan widoku i interakcje. Filtrowanie, rekomendacje i generowanie pliku kalendarza są osobnymi funkcjami; odpowiedzi asystenta obsługuje serwis. Subskrypcje parametrów tras kończą się wraz ze zniszczeniem komponentu.

## Formatowanie

Kod używa wcięć po dwie spacje, osobnych atrybutów HTML i jednolitego formatowania TypeScript/SCSS. Reguły zapisano w `.prettierrc.json` i `.editorconfig`.

```powershell
npm run format
npm run format:check
```

Pierwsza komenda formatuje kod, druga sprawdza zgodność bez modyfikowania plików. Pliki wynikowe, zależności i zasoby graficzne są pomijane przez `.prettierignore`.

## Granice prototypu

Początkowe dane repertuaru, ceny, obsady i statusy są demonstracyjne; panel zapisuje aktualną treść w PostgreSQL. Sprzedaż korzysta z adresów sprzedawców wpisanych przez redaktora. Integracja OpenAI jest przygotowana, ale wymaga klucza w API. Nie uruchomiono własnych płatności, uwierzytelniania konta, newslettera, zapisów grupowych ani nagrań. Nie należy przedstawiać początkowych danych jako aktualnej oferty instytucji.

API .NET w WUD2026 i panel WUD2026Admin obsługują hero i katalog wydarzeń. API uruchamia się poleceniem `dotnet run --launch-profile http` w WUD2026/WUD2026 (port 5296), a panel poleceniem `npm start` w WUD2026Admin (port 4201). Adres API określa `src/app/core/data/content-api.ts`. Przy niedostępnym API strona korzysta z treści demonstracyjnej. Nie publikowano strony w internecie.

Hero obsługuje osobny szkic, podgląd `/?heroPreview=1`, publikację natychmiastową i zaplanowaną. Promowane wydarzenie pochodzi z katalogu API. Dane są trwale zapisywane w PostgreSQL przez Entity Framework Core; odczyty strony udostępniają wyłącznie opublikowaną treść. Podgląd szkicu jest dostępny lokalnie w Development.

Katalog, edycja i harmonogram hero/wydarzeń oraz PostgreSQL są wdrożone. Autoryzacja kont, integracja iksoris, pełne tłumaczenia, semantyczna wyszukiwarka i wektorowy RAG pozostają dalszymi etapami. Język prototypu: polski. Dostępność interfejsu została uwzględniona w implementacji, ale nie stanowi to pełnego audytu WCAG ani deklaracji zgodności.

## Weryfikacja

- Produkcyjna kompilacja Angular/SSR.
- Dwadzieścia dwa testy jednostkowe: odczyt hero i podglądu, nawigacja, ograniczenia kreatora, brak fałszywych bezpłatnych propozycji, ulubione.
- Chromium: ścieżka debiutanta/rodzica, zapis i odtworzenie ulubionych, filtry URL, puste wyniki, wyprzedane wydarzenie, przejście do sprzedawcy, eksport ICS, skip link i brak błędów JS.
- Responsywność na szerokościach 360, 390, 768, 1024 i 1440 px.

```powershell
node node_modules/@angular/cli/bin/ng.js test --watch=false --browsers=ChromeHeadless
```

Karma wymaga dostępnej przeglądarki Chrome; można wskazać ścieżkę zmienną CHROME_BIN. Datę w testach kreatora zamrożono na 17 października 2026.

## Fotografie

Źródło: https://filharmonia.szczecin.pl/budynek — galeria budynku Filharmonii. Pliki są przechowywane lokalnie, a główne fotografie mają zoptymalizowane warianty WebP. Przed publicznym wdrożeniem należy potwierdzić prawa do publikacji i wymagane podpisy autorów.

## PrimeNG

Serwis korzysta z PrimeNG 19.1.4, zgodnego z używanym Angular 19, oraz @primeng/themes 19.1.4. Wspólny motyw Aura jest dostosowany w `src/app/core/theme/prime-theme.ts`; konfiguracja znajduje się w `app.config.ts`. Tryb ciemny systemu nie zmienia automatycznie kolorystyki strony. Nadpisania układu są w `src/styles/_primeng.scss`.

Używane komponenty: Button (dyrektywa pButton), Select, InputText, InputNumber, Checkbox, Card, Tag, Accordion, Drawer, Dialog, ProgressBar i Toast. Karty i symbole instytucji zachowują własną kompozycję. PrimeNG jest stosowany we wszystkich ośmiu widokach; routy są ładowane na żądanie.

Przy dodawaniu nowych kontrolek należy importować moduł PrimeNG w odpowiednim komponencie standalone i używać wspólnego presetu. Nie należy dodawać kolejnego, niezależnego motywu. Komunikaty są emitowane przez MessageService w PhilharmonicStore.

Migracja nie uruchamia tłumaczeń ani integracji produkcyjnych. Ostatnia kompilacja produkcyjna mieści się w limicie 1 MB, ale sygnalizuje przekroczenie ostrzegawczego budżetu początkowego 500 kB (około 787 kB przed kompresją, 182 kB szacowanego transferu). Kolejnym zadaniem wydajnościowym może być odroczenie ładowania kontrolek globalnych.

## PostgreSQL

Przed API uruchom bazę poleceniem docker compose up -d --wait postgres w katalogu WUD2026 albo skrypt scripts/Start-Local.ps1. API stosuje migracje i jednorazowo importuje JSON do pustej bazy. Później zapis i harmonogramy obsługuje PostgreSQL. Szczegóły, backup i testy: WUD2026/README.md.

Przycisk KUP BILET pobiera pełny adres HTTPS z API (ticketUrl). Nie prowadzi już do demonstracyjnego okna zakupu. Jeśli wydarzenie nie ma adresu, karta oferuje szczegóły, a strona wydarzenia informuje o braku linku. Przeszłe i wyprzedane wydarzenia nie oferują zakupu.

## Kustosz AI

Okno rozmowy i /asystent współdzielą jedną sesję API. AssistantService obsługuje odtwarzanie historii, zapis identyfikatora/tokena lokalnie, ponawianie tej samej wiadomości bez duplikatów i usunięcie rozmowy. CuratorConversationComponent renderuje odpowiedzi jako tekst oraz aktualne karty wydarzeń, link do sprzedawcy, Google Calendar i pobranie ICS. Nie renderuje HTML modelu. Wygląd korzysta ze wspólnej czerni, bieli i złota oraz PrimeNG. Zachowano animację od ikonki AI, rosnące w górę pole i dostęp do nawigacji.

Konfiguracja OpenAI, kontrakt API, limity i pamięć: WUD2026/README.md w projekcie API. Klucz nie występuje w Angularze. Brak konfiguracji daje czytelny błąd i możliwość ponowienia, bez imitowania odpowiedzi modelu. Google otwiera formularz do zatwierdzenia; płatność odbywa się u sprzedawcy.

Testy: 22 jednostkowe i produkcyjny build SSR. Chromium: karty/akcje, rzeczywisty plik ICS, odtworzenie po odświeżeniu, kontynuacja, błąd/ponowienie, współdzielona historia, nowa rozmowa, brak poziomego overflow 360–1440 px i widoczna mobilna nawigacja. Odpowiedzi modelu w teście UI były kontrolowane; model HTTP i baza osobno mają testy integracyjne. Bez klucza nie zweryfikowano jeszcze odpowiedzi rzeczywistego OpenAI.

Rozmowa AI jest renderowana wyłącznie w globalnym dialogu. Trasa /asystent otwiera to samo okno i zawiera przycisk ponownego otwarcia, bez osadzania historii w treści. Stałe granice dialogu, wewnętrzne przewijanie i scrollbar-gutter zapobiegają rozszerzaniu strony przy otwieraniu i długich odpowiedziach.

## Oficjalny repertuar

Baza WUD2027 zawiera 261 terminów pobranych z oficjalnego kalendarza (październik 2026–czerwiec 2027), obok 6 wcześniejszych wpisów. Oficjalne ID mają prefiks fs-, sourceUrl prowadzi do oryginału. 102 fotografie są lokalnie w public/images/official-*. Dla 161 terminów dostępny jest bezpośredni link sprzedaży. Brak ceny lub długości jest reprezentowany jako null i nie jest przedstawiany jako bezpłatny wstęp ani domyślna długość. Uwzględniono pasma wieku warsztatów. Oficjalne kalendarze ICS są pobierane z API, bez oznaczenia DEMO i bez zmyślonego końca. Import i jego ponowienie opisuje README projektu API. Nie ma automatycznej synchronizacji w tle. Testy jednostkowe: 24.

## Repertuar i Wydarzenia

/repertuar i /wydarzenia korzystają z tego samego komponentu, filtrując jeden katalog po tags: repertoire lub events. Kategorie są niezależne od tagu. Koncerty i spektakle muzyczne są repertuarem, zwiedzanie/wystawy/warsztaty/spotkania wydarzeniami. Dolny pasek: Główna, Repertuar, Wydarzenia, Konto melomana. Szczegóły pozostają wspólne i wracają do właściwej zakładki. Zachowano sticky sterowanie miesiącem i kategoriami. Katalog SSR jest przekazywany przez TransferState, aby klient nie zaczynał hydratacji od innych rekordów.

## Dostęp w sieci lokalnej

Uruchom npm start. Devserver nasłuchuje na 0.0.0.0:4200. Aktualny adres Wi-Fi komputera: http://10.26.77.49:4200. Przeglądarka łączy się z API na tym samym hoście, port 5296; SSR nadal korzysta z 127.0.0.1:5296. Po zmianie adresu DHCP zaktualizuj dozwolone hosty w angular.json (build.options.security.allowedHosts i serve.options.allowedHosts). API uruchom w katalogu rozwiązania: dotnet run --project WUD2026 --launch-profile http. Oba urządzenia muszą być w tej samej sieci bez izolacji klientów Wi-Fi.


## Konto melomana — Identity

/konto obsługuje rejestrację User/School, logowanie e-mail lub OAuth Google/Facebook/Apple/Microsoft, profil, bezpieczeństwo, zapis/odczyt ulubionych, eksport i usuwanie konta. Admin ma zakładkę Użytkownicy i odnośnik do panelu treści. Sesja HttpOnly należy do API, bez bearer w localStorage, z CSRF dla zmian. Dostawcy bez poświadczeń mają nieaktywne przyciski; e-mail wymaga SMTP. Konfiguracja i callbacki: ../WUD2026/IDENTITY.md. Nie zmieniano podziału Repertuar/Wydarzenia.

