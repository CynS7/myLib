// Einstiegspunkt der Ansicht: verbindet die HTML-Elemente mit der App-Logik aus src/core.

import { createApp } from '../core/index.js';
import { renderBookList, renderStats } from './book-list.js';
import { createBookForm } from './book-form.js';

const $ = (id) => document.getElementById(id);
const app = createApp();
const form = createBookForm(app, $);

// Fehler der Logik (z. B. Speichern fehlgeschlagen) als Hinweis anzeigen.
const run = (fn) => {
  try {
    fn();
  } catch (err) {
    alert(err.message);
  }
};

const listActions = {
  onToggleOwned: (book) => run(() => app.books.toggleOwned(book.id)),
  onToggleRead: (book) => run(() => app.books.toggleRead(book.id)),
  onEdit: (book) => form.edit(book),
  onDelete: (book) => {
    if (confirm(`„${book.title}“ löschen?`)) run(() => app.books.remove(book.id));
  },
};

function render() {
  const books = app.books.list({ filter: $('filter').value, query: $('search').value });
  renderBookList($('book-list'), $('empty'), books, listActions);
  renderStats($('stats'), app.books.stats());
}

app.books.subscribe(render);
$('search').addEventListener('input', render);
$('filter').addEventListener('change', render);

$('export-btn').addEventListener('click', () => {
  const blob = new Blob([app.books.exportJson()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mylib-buecher.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    app.books.importJson(await file.text());
  } catch {
    alert('Ungültige Datei.');
  }
  e.target.value = '';
});

// Optionaler eigener Google-Books-Schlüssel (nur auf diesem Gerät gespeichert).
$('google-key').value = app.settings.googleApiKey;
$('google-key').addEventListener('change', () => run(() => { app.settings.googleApiKey = $('google-key').value; }));

render();

// Als App installierbar und offline nutzbar machen.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}
// Den Browser bitten, die gespeicherten Bücher nicht automatisch zu löschen.
navigator.storage?.persist?.().catch(() => {});
