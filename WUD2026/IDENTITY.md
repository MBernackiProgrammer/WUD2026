> Konfiguracja od 19.10.2026 pochodzi wyłącznie ze zmiennych środowiskowych. Przykłady i mapowanie nazw: deploy/.env.example oraz deploy/README.md. Nie wpisuj poświadczeń do appsettings.json.

# Konta i logowanie

Zarządzanie kontami znajduje się w publicznym `/konto` (Konto melomana). Nie zmieniono podziału Repertuar/Wydarzenia ani kalendarza.

## Uruchomienie i konfiguracja

Poświadczenia pochodzą wyłącznie ze środowiska. Użyj `deploy/.env.example` dla kontenerów albo `WUD2026/.env.example` dla natywnego .NET. Bez ustawienia hasła bazy API nie uruchomi się. Dla natywnego uruchomienia ustaw zmienne i wykonaj `dotnet run --project WUD2026 --no-launch-profile`.

Sekcja `Authentication`:

| Dostawca | Pola | Ścieżka callback API |
| --- | --- | --- |
| Google | `Google:ClientId`, `Google:ClientSecret` | `/signin-google` |
| Facebook | `Facebook:ClientId` (App ID), `Facebook:ClientSecret` (App Secret) | `/signin-facebook` |
| Microsoft | `Microsoft:ClientId`, `Microsoft:ClientSecret` | `/signin-microsoft` |
| Apple | `Apple:ClientId` (Services ID), `Apple:TeamId`, `Apple:KeyId`, `Apple:PrivateKey` | `/signin-apple` |

`Authentication:Apple:PrivateKey` zawiera pełną treść klucza `.p8` w formacie PEM (w JSON nowe linie jako `\n`). API generuje podpisany ES256 client secret na wymianę kodu; nie trzeba ręcznie aktualizować kilkumiesięcznego JWT. Apple wymaga powiązania Services ID z aplikacją obsługującą Sign in with Apple. Logowanie jest po stronie serwera, z walidacją podpisu tokena, issuer, audience, state i nonce.

Dostawcy muszą mieć wpisany **dokładny publiczny adres callback API**, np. `https://api.twoja-domena.pl/signin-google`, a nie adres frontendu ani `/api/account/external/callback`. Dla lokalnego Google/Microsoft można zarejestrować obsługiwany przez dostawcę wariant localhost, np. `http://127.0.0.1:5296/signin-google`. Facebook i Apple wymagają odpowiedniej konfiguracji HTTPS i domen. Apple nie zadziała na prywatnym adresie HTTP Wi-Fi: potrzebny jest zarejestrowany adres HTTPS dostępny dostawcy. Jeśli używasz lokalnego HTTPS API na 7217, aktualny frontend deweloperski musi otrzymać zgodny adres API lub reverse proxy.

Microsoft: aplikacja musi dopuszczać typy kont, z których użytkownicy będą korzystać (konta organizacyjne i/lub osobiste). Facebook: udostępnij uprawnienie e-mail i skonfiguruj dozwolone OAuth redirect URI; tryb aplikacji i konta testowe wpływają na dostępność logowania.

Po stronie API `Cors:AllowedOrigins` uzupełnij o dokładne originy aplikacji, np. `https://filharmonia.twoja-domena.pl` i `https://admin.twoja-domena.pl`. Aktualne adresy lokalnych interfejsów HTTP na portach 4200/4201 dodawane są automatycznie. Nie ma globalnego `AllowAnyOrigin`. Do wdrożenia używaj frontendu i API w tym samym site HTTPS (np. wspólna domena i subdomeny); ciasteczka mają SameSite=Lax. TLS za reverse proxy wymaga skonfigurowanych zaufanych forwarded headers po stronie hostingu; nie ufaj dowolnym proxy.

Przy zmianie hosta aplikacji zaktualizuj też `Identity:FrontendUrl` — to adres używany w linkach e-mail. W środowisku lokalnym zaloguj się w publicznym koncie i otwieraj panel admina przy użyciu **tej samej nazwy hosta** (127.0.0.1 i localhost mają osobne ciasteczka).

## Pierwszy administrator

Uzupełnij `Identity:BootstrapAdmin:Email` i `Identity:BootstrapAdmin:Password`, następnie zrestartuj API. Hasło wymaga co najmniej 12 znaków, małej i wielkiej litery oraz cyfry. Konto zostanie utworzone i przypisane do roli Admin. Jeśli wskazany e-mail już istnieje, konfiguracja jawnie nadaje temu kontu Admin; nie resetuje istniejącego hasła. Po utworzeniu administratora wyczyść pola BootstrapAdmin, aby kolejne starty nie odtwarzały przypisania roli.

Nie istnieje publiczna rejestracja administratora ani domyślne wspólne hasło. Administrator nadaje role innym kontom w Konto melomana → Użytkownicy. Publiczna rejestracja dopuszcza wyłącznie User i School. Każde konto ma jeden typ. Ostatniego administratora nie można usunąć ani zdegradować; operacje są serializowane blokadą transakcyjną PostgreSQL.

## E-mail i odzyskiwanie dostępu

W `Email` ustaw `From` oraz `Smtp:Host`, `Port` (domyślnie 587), `EnableSsl`, `Username`, `Password`. SMTP używa STARTTLS przy EnableSsl. Nie wyświetlamy tokenów resetu ani linków potwierdzenia w API lub interfejsie.

`Identity:RequireConfirmedEmail` domyślnie false pozwala od razu przetestować rejestrację i logowanie lokalne. Po skonfigurowaniu SMTP można włączyć true: logowanie wymaga wtedy potwierdzonego adresu. Przycisk ponownej wysyłki jest w formularzu logowania, po wpisaniu adresu. Nowe konta zewnętrzne również wymagają potwierdzenia, jeżeli włączono tę opcję (bez zakładania, że każdy provider potwierdził adres).

Reset hasła i zmiana e-mail korzystają z tokenów Identity ważnych 2 godziny. Zmiana adresu następuje dopiero po otwarciu i zatwierdzeniu linku. Link nie loguje automatycznie użytkownika. Bez SMTP te funkcje zgłaszają niedostępność; logowanie hasłem i działający OAuth nie są symulowane. Brak dostawcy w konfiguracji oznacza nieaktywny przycisk.

## Funkcje konta

- Rejestracja i logowanie e-mailem; pamiętanie sesji; blokada po 5 błędnych hasłach na 15 minut.
- Imię/nazwa, opcjonalny telefon, dla School nazwa i adres szkoły. Konto szkoły nie oznacza weryfikacji instytucji ani specjalnych rabatów.
- Ustawienie/zmiana hasła, potwierdzenie i zmiana e-mail, reset hasła, wylogowanie obecnej i wszystkich sesji.
- Podłączanie/odłączanie Google, Facebook, Apple i Microsoft z zalogowanego konta. Nigdy automatycznie po samym zgodnym e-mailu. Jeśli e-mail już istnieje, trzeba zalogować się wcześniejszą metodą i jawnie podłączyć dostawcę.
- Odłączenie ostatniego sposobu logowania bez hasła jest blokowane. Wrażliwe operacje kont zewnętrznych wymagają świeżego logowania (15 minut).
- Serduszka są dostępne wyłącznie po zalogowaniu. Kliknięcie zapisuje ulubione od razu na koncie przez chronione API; stan zmienia się dopiero po potwierdzeniu zapisu. Lista wczytuje się z sesją konta i znika po wylogowaniu. Nie odczytujemy dawnych lokalnych ulubionych. Zapis sprawdza oczekiwany identyfikator konta.
- Eksport profilu JSON bez haseł, hashy, tokenów dostawców czy security stamp.
- Usunięcie konta wymaga hasła lub świeżego logowania zewnętrznego i wpisania USUŃ. Usuwane są dane Identity, podłączone loginy, role konta i ulubione na koncie. Anonimowa rozmowa HarmonIA jest odrębna, nie jest automatycznie powiązana z kontem. Zakupy pozostają u zewnętrznych sprzedawców — nie generujemy fikcyjnej historii biletów.
- Administratorzy: lista kont, wyszukiwanie, stronicowanie 25 pozycji i zmiana roli. Panel treści na 4201 korzysta z tej samej sesji i jest dostępny wyłącznie Admin. API `/api/admin` także wymaga roli — sam loopback już nie daje dostępu.

## Technika

ASP.NET Core Identity 10 + EF Core/Npgsql w istniejącym ContentDbContext, migracja `20261017230155_AddIdentityAccounts` dodaje standardowe tabele AspNet*. Dane repertuaru, hero i rozmów pozostają w swoich tabelach. Role inicjalizowane idempotentnie przy starcie. Fabryka DbContext używana przez dotychczasowy CMS pozostaje obsługiwana.

Sesja to szyfrowane/podpisane ciasteczko HttpOnly, nie token w localStorage. W Development dostępne HTTP/LAN; poza Development Secure=Always. SecurityStamp sprawdzany przy każdym żądaniu — zmiana hasła/roli i wylogowanie ze wszystkich urządzeń unieważniają pozostałe sesje. Klucze ASP.NET Data Protection należy zachować pomiędzy restartami/wdrożeniami (lokalnie używany standardowy magazyn profilu użytkownika, w kontenerze potrzebny trwały magazyn kluczy).

Zmiany konta i treści CMS wymagają tokena antiforgery, odczytywanego z `/api/account/csrf`; przeglądarka wysyła credentials. Rozpoczęcie OAuth to POST z tokenem CSRF; return origin jest sprawdzany przed challenge i zabezpieczony stanem OAuth. Konta mają limit 100 żądań/min/IP, dodatkowo Identity ogranicza błędne logowania. Tokeny dostawców nie są zapisywane (`SaveTokens` pozostaje false).

Nowe endpointy `/api/account`: `session`, `csrf`, `register`, `login`, `logout`, `logout-all`, `profile`, `password`, `forgot-password`, `reset-password`, `resend-confirmation`, `email`, `confirm-email`, `favorites`, `export`, DELETE podstawowego endpointu, `external/{provider}`, `external/callback`, `users`, `users/{id}/role`.

## Źródła integracji

- [ASP.NET Core Identity — external providers](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/social/?view=aspnetcore-10.0)
- [Sign in with Apple — configuration](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)


## Gotowy hosting produkcyjny

Konfigurację jednej domeny HTTPS z /api i /admin/ opisuje deploy/README.md. W takim wdrożeniu plik poświadczeń to zmienne środowiskowe opisane w deploy/.env.example, a Identity:FrontendUrl i CORS ustawia Compose. Nie ma potrzeby zmieniania kodu adresów API ani używania osobnej subdomeny. Powyższe opisy portów4200/4201/5296 dotyczą wyłącznie lokalnego Development. Pliki appsettings nie są ładowane jako konfiguracja operacyjna. Kod przekierowań ufa wyłącznie określonemu proxy, cookies zachowują Secure i trwałe klucze DataProtection.

