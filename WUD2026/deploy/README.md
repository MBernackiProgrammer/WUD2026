# Wdrożenie kontenerowe — konfiguracja wyłącznie ze środowiska

Układ katalogów: `WUD2026/` (API i Compose), `WUD2026F/` (publiczny Angular SSR), `WUD2026Admin/` (panel). Wymagane Docker Engine i Compose. Publiczne porty: tylko gateway 80/443. API, Node, panel i PostgreSQL pracują w prywatnej sieci.

## Uruchomienie

W katalogu rozwiązania `WUD2026`:

```sh
cp deploy/.env.example deploy/.env
# Uzupełnij deploy/.env na serwerze lub wstrzyknij te same zmienne z magazynu sekretów.
chmod 600 deploy/.env
docker compose --env-file deploy/.env -f compose.production.yaml config --quiet
docker compose --env-file deploy/.env -f compose.production.yaml up -d --build --wait
docker compose --env-file deploy/.env -f compose.production.yaml ps
```

PowerShell: `Copy-Item deploy/.env.example deploy/.env`. Nie uruchamiaj `docker compose config` bez `--quiet` w logach CI: rozwinięty manifest zawiera wartości środowiska. Plik `.env` jest lokalnym sposobem dostarczenia środowiska, nie konfiguracją przeznaczoną do repozytorium ani obrazu. Na produkcji można zastąpić go zmiennymi z CI/orchestratora. Nie ma domyślnych haseł.

## Zmienne

| Obszar | Zmienne |
| --- | --- |
| Domena | `SITE_HOST`, `PUBLIC_SITE_URL` (HTTPS), opcjonalnie `SITE_ADDRESS`, `HTTP_BIND`, `HTTPS_BIND` |
| Baza | wymagane `POSTGRES_PASSWORD`; `POSTGRES_DB`, `POSTGRES_USER`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_SSL_MODE`, `DATABASE_MIGRATE` |
| AI | `OPENAI_API_KEY`, `AI_MODEL`, `AI_MAX_OUTPUT_TOKENS`, `AI_SESSION_DAYS`, `AI_MAX_TURNS` |
| Pierwszy administrator | `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`; po utworzeniu konta usuń obie wartości i odtwórz API |
| Poczta | `SMTP_HOST`, `SMTP_PORT`, `SMTP_ENABLE_SSL`, `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `REQUIRE_CONFIRMED_EMAIL` |
| OAuth | `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET`, `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` |
| Adresy przeglądarki | `PUBLIC_API_URL=/api`, `PUBLIC_ADMIN_URL=/admin/`, `PUBLIC_SITE_URL` |
| Prywatny adres SSR | `INTERNAL_API_URL=http://api:8080/api` — nigdy nie jest publikowany w JS konfiguracji |
| Hosting | `NG_ALLOWED_HOSTS`, `ALLOWED_HOSTS`, `LOG_LEVEL`, `PUBLICATION_INTERVAL_SECONDS`, `TZ` |
| Sieć proxy | `GATEWAY_IP`, `NETWORK_SUBNET`, `NETWORK_IP_RANGE` — zmieniaj je spójnie, jeśli subnet koliduje z infrastrukturą |

Wszystkie sekrety są opcjonalne poza hasłem bazy. Bez klucza AI asystent zgłasza niedostępność; bez poświadczeń OAuth przyciski dostawców są nieaktywne. Bez SMTP nie działa odzyskiwanie hasła ani wysyłanie potwierdzeń. Produkcyjne `REQUIRE_CONFIRMED_EMAIL=true` wymaga skonfigurowanej poczty do logowania nowych kont.

Publiczne adresy są podawane przy starcie przez `/runtime-config.js` oraz `/admin/runtime-config.js` z `Cache-Control: no-store`. To jawna lista dozwolonych pól, nigdy eksport całego środowiska. Zmiana adresów nie wymaga przebudowy Angulara; wymaga odtworzenia odpowiedniego kontenera. Haseł, kluczy i prywatnych adresów nie przekazuj przez `PUBLIC_*`.

API czyta zmienne .NET z separatorami `__`, np. `Database__Host`, `Database__Password`, `Ai__ApiKey`. Compose mapuje nazwy z tabeli na te zmienne. Alternatywnie obsługiwane jest `ConnectionStrings__ContentDatabase` ze środowiska; ma pierwszeństwo nad osobnymi polami bazy. Osobne pola prawidłowo obsługują średniki i znaki specjalne w hasłach. Pliki `appsettings*.json` nie są źródłem konfiguracji uruchomieniowej i nie trafiają do publikacji API.

## TLS, proxy i OAuth

DNS domeny musi wskazywać serwer, a porty 80/443 muszą być osiągalne, by Caddy pobrał certyfikat. Callbacki OAuth rejestruj pod tą samą domeną: `/signin-google`, `/signin-facebook`, `/signin-microsoft`, `/signin-apple`. Apple wymaga własnego klucza PEM (można użyć literalnych `\n`), Services ID, Team ID i Key ID. Caddy przekazuje `/api` bez usuwania prefiksu. API ufa tylko określonemu adresowi gateway; nie wystawiaj portów API/SSR bezpośrednio do Internetu.

Jeśli istniejący Nginx już zajmuje 80/443, nie uruchamiaj drugiego proxy na tych samych portach. Użyj osobnych portów gateway oraz lokalnego HTTP (`SITE_ADDRESS=http://:80`) za swoim Nginx; `PUBLIC_SITE_URL` pozostaje publicznym HTTPS. Zaufanie dodatkowym nagłówkom proxy trzeba skonfigurować dla tej topologii. Standardowy plik Compose zakłada Caddy jako jedyny publiczny terminator TLS.

## Dane i aktualizacje

Wolumeny zachowują bazę, klucze ASP.NET Data Protection i certyfikaty. Nie używaj `down -v` przy aktualizacji. Zmiana hasła w środowisku nie zmienia hasła istniejącego użytkownika PostgreSQL w istniejącym wolumenie — rotację wykonaj również w bazie. Bez importu danych nowa baza zostanie zainicjalizowana z `Seed/content.json`; istniejący lokalny repertuar nie jest automatycznie kopiowany.

Przed startem API na nowej produkcji można przywrócić sprawdzony dump do pustej bazy. Kopie i klucze Identity przechowuj bezpiecznie poza repozytorium i serwerem aplikacji. Skrypt `scripts/Backup-Database.ps1 -EnvFile deploy/.env -ComposeFile compose.production.yaml` korzysta z nazwy bazy i użytkownika ustawionych w kontenerze.

Aktualizacja:

```sh
docker compose --env-file deploy/.env -f compose.production.yaml up -d --build --wait
```

## Kontrola

Compose sprawdza gotowość PostgreSQL, `/health/ready` API, `/_health` SSR i `/healthz` panelu. Sprawdź odświeżenie podstrony, `/admin/`, rejestrację i logowanie, trwałość ulubionych, status AI, callbacki i e-maile. Testy nie powinny wykonywać płatnych wywołań AI.

Usunięcie klucza z plików nie unieważnia go u dostawcy i nie usuwa dawnych kopii obrazów ani historii Git. Wcześniej zapisany klucz AI i inne ujawnione poświadczenia należy odwołać lub obrócić u dostawcy. Stare obrazy/build cache usuń dopiero po upewnieniu się, że nie są potrzebne do innych wdrożeń; to osobna operacja administracyjna.

Kontrolę plików źródłowych uruchom poleceniem: `python scripts/check-secrets.py`. Skrypt wypisuje lokalizacje problemów bez wartości sekretów; nie zastępuje kontroli historii repozytorium ani rotacji poświadczeń.
