# Wydarzenia, kalendarz i wyszukiwanie

Stan wdrożenia: 18.10.2026. Uzupełnienie IDENTITY.md i deploy/README.md.

## Model i zapis

Nadal istnieje jedna tabela Events. Migracja `20261018000008_AddEventDetails` dodaje kolumnę JSONB `Details` z domyślnym `{}` i dopuszcza status `last-tickets`. Migracja jest zastosowana w lokalnym WUD2027; zachowano267 rekordów. Skrypt idempotentny: WUD2026/Data/Migrations/deploy.sql. Nie uruchamiać migracji Down na danych ze statusem last-tickets bez uprzedniej zmiany statusu — poprzedni schemat go nie obsługuje.

Bazowe pola i kontrakty API są zachowane. `EventContent.Details` jest typowanym agregatem `EventDetails`, przechowywanym jako JSONB przez mapowanie EF. Zmiana szczegółów zapisuje się atomowo z wydarzeniem oraz pełną migawką ContentRevisions. Artyści, miejsce, utwory, artykuły i FAQ są obiektami osadzonymi. Profile artystów i artykuły identyfikuje stabilny slug (małe litery, cyfry, myślniki); używanie tego samego id w kilku wydarzeniach łączy listę powiązanych wydarzeń. Pierwszy opublikowany profil tego id jest używany na stronie profilu — redakcja powinna utrzymywać spójne dane tego samego artysty. Nie tworzono osobnych repozytoriów artystów/mediów ani systemu uploadu; pola URL wskazują istniejące zasoby.

Details zawiera:
- type: concert, cycle, festival, exhibition, education, tour, other;
- endDate, intermissionMinutes (0=bez przerwy; null=nieznana), priceMax, ageMax, whyAttend;
- accessibility: mobility, visual, hearing, sensory; accessibilityNotes, sensoryNotes;
- programUrl, promoted, promotionPriority (0–100);
- venue: name, number, address, directions, planUrl, accessibility;
- collection (również dla koncertu należącego do cyklu): name, season, description, passes, passUrl;
- exhibition: title, gallery, artists, curator, openingAt (lokalny YYYY-MM-DDTHH:mm), photos;
- education: group, age (opis), registration, registrationUrl, benefits;
- performers: id, name, role/instrument, biography, photoUrl;
- works: title, composer, duration w minutach, audioUrl;
- articles: id, title, text, date, media (zdjęcia), tags;
- faqs: question, answer, category.

Weryfikacja API obejmuje zagnieżdżone DataAnnotations, limity50 pozycji/listę, unikalne id w obrębie wydarzenia, enum typu i dostępności, daty, kolejność końca/początku, cenę maksymalną względem ceny od i wiek maksymalny względem minimalnego. Linki wymagają HTTPS bez credentiali lub lokalnego /images/ albo /files/. Teksty renderowane przez interpolację Angulara, bez niezaufanego innerHTML. Legacy JSON `{}` dostaje typ wywnioskowany z dotychczasowej kategorii/podtytułu (wystawa, zwiedzanie, warsztaty, koncert), bez dopisywania fikcyjnych biogramów, cen czy udogodnień. Import oficjalnego repertuaru zachowuje istniejące Details redakcji i pozostaje idempotentny również przy skalowanych liczbach decimal PostgreSQL.

## Panel redakcyjny

Edycja wydarzenia ma dodatkowy komponent EventDetailsEditorComponent. Zawiera zwykłe opisane formularze, sekcje rozwijane i dodawanie/usuwanie pozycji artystów, utworów, artykułów i FAQ — bez konieczności wpisywania JSON. Wszystkie dane przechodzą przez istniejące PUT /api/admin/events/{id}, rolę Admin, CSRF, kontrolę rewizji i planowanie publikacji. Tagi redakcyjne edytuje się po jednym w wierszu; dokładnie jeden techniczny tag repertoire/events pozostaje zachowany. Pola URL nie przesyłają plików; nagrania i PDF muszą wcześniej istnieć pod podanym adresem. DatePicker/InputNumber/Select/Checkbox/MultiSelect to PrimeNG, ikony SVG. Lokalne pola dat/godzin zachowują dotychczasowy adapter ISO. Oba fronty mają polskie nazwy dni i miesięcy.

## Podstrona i funkcje

Podsumowanie przed zdjęciem: tytuł, termin/zakres, sala, dla kogo i wiek, czas/przerwa, potwierdzona cena od–do i zakup u sprzedawcy. Brak ceny nadal oznacza brak ceny i jej separatora; brak udogodnień lub przerwy jest opisany jako brak potwierdzenia. Dalsze sekcje pokazują wyłącznie dostarczone dane: dlaczego warto, program, artystów z profilami, cykl/karnety, wystawę i galerię, edukację/zapisy, dostępność/sensorykę, plan i trasę Google Maps, artykuły, FAQ, a po FAQ kontakt. Dane infolinii (+48 539949454, wt–czw10–16) zweryfikowane18.10.2026 w https://filharmonia.szczecin.pl/kontakt. Przycisk tel: otwiera dialer urządzenia.

Odsłuch: własny przycisk SVG play/pause nad ukrytym elementem audio (bez natywnych kontrolek systemowych), pauzuje fragment po60 sekundach, bez autoplay; błąd pliku sygnalizowany. Nie jest to serwerowy transkoder ani zabezpieczenie pełnego nagrania — redakcja powinna podać przygotowany fragment z prawami do publikacji.

Zapis w kalendarzu otwiera PrimeNG Dialog z Google, Apple i Outlook (ICS). Google: nowy publiczny GET /api/events/{id}/calendar/google przekierowuje wyłącznie do wygenerowanego calendar.google.com dla opublikowanego wydarzenia. Nie jest zapisem do konta użytkownika przez OAuth. Istniejący ICS współdzielony z HarmonIA uwzględnia miejsce/adres i datę końca wystawy, zachowuje UTC Europe/Warsaw/DST oraz escapowanie/folding. Przy samej dacie końca bez godziny używane23:59 lokalnie. Nieznany czas trwania pojedynczego wydarzenia nadal nie generuje fikcyjnego końca w ICS.

Udostępnianie używa Web Share API, a przy braku wsparcia dialogu z linkiem i kopiowaniem; przy niedostępnym Clipboard (np. HTTP LAN) użytkownik może zaznaczyć link ręcznie. Ulubione nadal wymagają logowania. Podobne wydarzenia: przyszłe, zgodna kategoria/cykl lub promowane; najpierw promoted, potem promotionPriority i termin. Nie ma losowania.

Wallet Apple/Google nie został uruchomiony: nie ma integracji operatora ani podpisanych prawdziwych biletów. Nie pokazujemy przycisku, który sugerowałby istniejący bilet. To świadomie pominięta warunkowa część specyfikacji.

## Nawigacja, wyszukiwanie i filtry

Mobile5 pozycji: Główna / Wyszukaj / wyróżniony Kalendarz / O Filharmonii / Konto. /kalendarz obejmuje cały opublikowany katalog z obu tagów. Istniejące /repertuar i /wydarzenia oraz linki pozostają jako zawężone widoki; desktopowe menu zachowane. Wyszukiwanie /szukaj?q=... obejmuje wydarzenia, metadane i informacje dodatkowe, osadzone profile artystów, artykuły oraz publiczne strony informacyjne (wizyta, konto, Filharmonia, kalendarz, quiz). Nie przeszukuje prywatnych kont, redakcyjnych szkiców ani historii rozmów.

Adresy profili: /artysta/:id i /artykul/:id. Wyniki profili pochodzą wyłącznie z opublikowanego katalogu. Brak jeszcze biogramów/mediów w starych danych nie jest wypełniany wymyśloną treścią; należy je dodać w panelu.

Filtry w URL: month, q, category, date, budget, age, available oraz from/to/audience/mood/room/priceMin/duration/durationMin/durationMax/accessibility/performer/composer/cycle/tag/type/status. date: today/tomorrow/week/weekend/month/range; jawny month obejmuje archiwum, a zakres from/to może obejmować przeszłość. Daty liczone względem Warszawy; przedziały wystaw przecinające miesiąc są widoczne. duration:45/90/long/custom. budget to cena do (0=bezpłatne), priceMin cena od; sprawdzane przecięcie z potwierdzonym przedziałem cen. Nieznane ceny/czas/dostępność nie przechodzą filtrów wymagających tych faktów. available obejmuje available i last-tickets. Brak wartości oznacza brak danego ograniczenia. Wybór miesiąca czyści date/from/to, bo zastępuje zakres. Zmiany używają historii routera (replaceUrl=false) dla Wstecz; wyszukiwanie globalne aktualizuje q przez replaceUrl przy pisaniu. Liczniki: po filtrowaniu / dla wyszukania / cały katalog. Brak wyników: wyczyszczenie kryteriów lub kolejny miesiąc. Chronologia, autoscroll do najbliższego wydarzenia, sticky kategorie i miesiąc, szarość archiwum, warunki cen i anonimowych serduszek zachowane.

## Walidacja i granice

Testy API na odizolowanych bazach Testcontainers (nie na realnym WUD2027), jednostkowe Angular i QA Playwright opisane również w kontekst.md. work/verify-event-spec.cjs używa fikcyjnych, jawnie testowych danych i mockuje zapisy admina, nie dopisuje ich do WUD2027. Sprawdza pierwszy ekran mobilny,5 pozycji menu, profile i wyszukiwanie informacji, filtry/reload/Wstecz, kolejność FAQ, kalendarz i serializację zagnieżdżonych pól. Buildy mają istniejące ostrzeżenia budżetu500kB, pozostają poniżej limitu błędu1MB. Nie wykonywano płatnych wywołań modelu ani publikacji na publicznej domenie. Dane267 wydarzeń zachowane; migracja nie zawiera sztucznych uzupełnień.
