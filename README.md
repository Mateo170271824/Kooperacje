# Kooperacje

Kalendarz odbiorów od podwykonawców. Działa na wspólnej bazie z Truck App (Firebase `logistyka-app-41d7a`).
Zlecenie z zaznaczonym „wyślij do logistyki” trafia do Truck App jako kurs. Kierowcę przypisuje logistyka.

- Strona: **https://steel-flow.web.app/kooperacje/** (część SteelFlow; stary adres https://mateo170271824.github.io/Kooperacje/ tylko przekierowuje)
- APK: https://github.com/Mateo170271824/Kooperacje-App/releases/latest/download/Kooperacje.apk (publiczne repo tylko na plik aplikacji)

## Kod
- `index.html`, `css/style.css`: wygląd
- `js/app.js`: aplikacja (widoki, zapis do bazy)
- `js/logika.js`: logika bez przeglądarki (daty, alerty, kurs w Truck App, weryfikacja PZ, import podwykonawców)
- `vendor/`: biblioteki XLSX i PDF

Danych podwykonawców nie ma w kodzie (repozytorium jest publiczne). Administrator wczytuje je z pliku Excel
(Podwykonawcy → „Wczytaj podwykonawców z Excela”, kolumny: Nazwa, Osoba / dział, Telefon, Adres odbioru, E-mail, Osoba 2, Telefon 2, E-mail 2).

## Testy
- `npm test`: testy logiki (`tests/*.test.mjs`)
- `npm run test:e2e`: test ekranowy całej aplikacji na emulatorze bazy (`tests/e2e`). Reguły bazy w `tests/e2e/firestore.rules` są kopią reguł z repozytorium Logistyka. Po ich zmianie trzeba je skopiować ponownie.

GitHub Actions uruchamia oba rodzaje testów przy każdej zmianie. Strona publikuje się z `main` tylko wtedy, gdy testy przejdą.

## Ustawienia repozytorium
- Settings → Pages → Source: **GitHub Actions**
- Sekrety `ANDROID_KEYSTORE_BASE64` i `ANDROID_KEYSTORE_PASSWORD`: te same co w Zapytaniach / Kalkulatorze stali. Bez nich APK buduje się tylko próbnie i nie jest publikowane.
