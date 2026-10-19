# Panel redakcyjny Filharmonii

Angular 19 i PrimeNG, biało-czarno-złoty interfejs zgodny ze stroną publiczną.

## Uruchomienie lokalne

1. W projekcie API WUD2026/WUD2026: `dotnet run --launch-profile http` (port 5296).
2. W WUD2026F: `npm ci`, następnie `npm start` (port 4200).
3. W WUD2026Admin: `npm ci`, następnie `npm start` (http://127.0.0.1:4201).

Adresy API i strony publicznej określa `src/app/core/data/content-api.ts`.

## Hero strony głównej

Można zmieniać teksty, wyróżniony fragment tytułu, zdjęcie z biblioteki lub adresu HTTPS, opis alternatywny, etykiety i wewnętrzne adresy przycisków oraz promowane wydarzenie. Podgląd w panelu reaguje na niezapisane zmiany.

Zapis wersji roboczej nie zmienia strony publicznej. Po zapisaniu można otworzyć podgląd całej strony, opublikować hero od razu lub zaplanować publikację. Termin podaje się w czasie Europe/Warsaw. Zaplanowana kopia jest niezależna od późniejszych poprawek szkicu; można ją anulować. Wydarzenie promowane musi być opublikowane najpóźniej w terminie publikacji hero.

## Wydarzenia

Zakładka Wydarzenia pozwala dodawać i edytować repertuar, program, zdjęcie, ceny oraz termin i stan publikacji. Szkice i wydarzenia oczekujące na publikację nie trafiają do publicznego katalogu. Hero pobiera dane promowanego wydarzenia bezpośrednio z tego katalogu.

API przechowuje dane w PostgreSQL przez Entity Framework Core i wykrywa równoczesną edycję przez numer wersji. Przy konflikcie zachowaj swoje poprawki przed ponownym pobraniem danych. Zaplanowaną publikację wykonuje usługa API w tle; nie wymaga otwartego panelu ani odczytu strony.

Panel działa lokalnie w środowisku Development. Dostęp administracyjny w internecie wymaga dodania uwierzytelniania i uprawnień.

## Weryfikacja

`npm run build`, `npm run format:check` oraz `ng test --watch=false --browsers=ChromeHeadless`.

Dziewięć testów jednostkowych obejmuje ochronę przed publikacją niezapisanych zmian, konflikt zapisu oraz konwersję terminów z uwzględnieniem czasu letniego i zimowego.

## PostgreSQL

Przed API uruchom bazę poleceniem docker compose up -d --wait postgres w katalogu WUD2026 albo skrypt scripts/Start-Local.ps1. API stosuje migracje i jednorazowo importuje JSON do pustej bazy. Później zapis i harmonogramy obsługuje PostgreSQL. Szczegóły, backup i testy: WUD2026/README.md.

Pole Link do sprzedawcy biletów w formularzu wydarzenia zapisuje opcjonalny pełny adres HTTPS (do 2048 znaków). To docelowa strona przycisku KUP BILET na publicznym froncie. Pozostaw puste, jeśli nie ma jeszcze właściwego adresu; nie wstawiaj adresu innego wydarzenia.

## Oficjalny repertuar

WUD2027 zawiera import 261 terminów oficjalnego kalendarza z ID fs-. Formularz zachowuje sourceUrl przy zapisie, obsługuje puste ceny/czasy trwania, pełne obsady do 2000 znaków i zaimportowane fotografie w selekcie. Puste pola numeryczne oznaczają brak opublikowanej informacji. Jednorazowe i ponowne pobranie jest osobną operacją CLI opisaną w README API; ponowienie może nadpisać ręczne zmiany dla tego samego ID.

Pole Zakładka w serwisie wybiera tag repertoire/events niezależnie od kategorii. Zapis zachowuje pozostałe tagi i źródło. Wszystkie wydarzenia nadal znajdują się w jednej tabeli Events; migration AddCatalogTags uzupełnia dotychczasowe rekordy.

## Dostęp administratora — Identity

Panel nie wczytuje treści bez sesji w roli Admin. Zaloguj się w publicznym Koncie melomana na tym samym hoście (np.127.0.0.1), a następnie wróć i kliknij Sprawdź ponownie. Interceptor wysyła cookies oraz token CSRF dla zmian. API niezależnie sprawdza rolę i CSRF. Konfiguracja pierwszego administratora i dostawców: ../WUD2026/IDENTITY.md. Dawne opisy dostępu po samym localhost są historyczne.

