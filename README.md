# myLib

App zur Verwaltung der eigenen Bücher: Wunschliste, im Besitz, lese ich gerade, gelesen (mit Datum) und Lesesprache (Deutsch/Englisch). Buchdaten lassen sich per ISBN abrufen.

## Aufs iPhone installieren

1. Die App-Adresse in **Safari** öffnen: https://cyns7.github.io/myLib/
2. Auf **Teilen** tippen und dann **Zum Home-Bildschirm** wählen.
3. myLib startet danach wie eine normale App vom Home-Bildschirm, im Vollbild und auch offline.

Die Bücher werden dauerhaft auf dem Gerät gespeichert. „Exportieren“ ist nur noch als Sicherung oder für einen Gerätewechsel nötig.

## Veröffentlichen (einmalig)

Im Repository unter **Settings → Pages** bei *Source* „Deploy from a branch“ wählen, dann den Branch und den Ordner `/ (root)` angeben.

## Aufbau

Logik und Ansicht sind getrennt. Die Ansicht kann dadurch umgebaut oder ganz ersetzt werden, ohne die Logik anzufassen.

```
index.html            Grundgerüst der Seite
src/core/             App-Logik – kein Zugriff auf HTML/Anzeige
  index.js            Einstiegspunkt: createApp() → { books, settings, lookupIsbn }
  books.js            Bücher: Datenmodell, Regeln, Filter, Statistik, Speichern
  isbn.js             ISBN-Hilfen und Suche in Google Books, DNB, Open Library, lobid
  covers.js           Mögliche Cover-Adressen eines Buchs
  settings.js         Geräte-Einstellungen (Google-API-Schlüssel)
  storage.js          Zugriff auf den Gerätespeicher
src/ui/               Ansicht
  main.js             Verbindet HTML-Elemente mit der Logik
  book-list.js        Darstellung der Liste
  book-form.js        Formular zum Hinzufügen/Bearbeiten
  style.css           Aussehen
tests/                Tests der Logik (npm test)
sw.js                 Offline-Unterstützung
```

Die Ansicht nutzt nur `createApp()` aus `src/core/index.js`:

- `app.books.list({ filter, query })`, `app.books.stats()`, `app.books.get(id)`
- `app.books.add(data)`, `app.books.update(id, data)`, `app.books.remove(id)`
- `app.books.toggleOwned(id)`, `app.books.toggleReading(id)`, `app.books.toggleRead(id)`
- `app.books.exportJson()`, `app.books.importJson(text)`
- `app.books.subscribe(callback)`: wird nach jeder Änderung aufgerufen
- `app.lookupIsbn(isbn)`, `app.settings.googleApiKey`

Tests laufen mit `npm test` (Node.js 20 oder neuer, keine Installation nötig).
