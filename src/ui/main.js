// Einstiegspunkt der Ansicht: verbindet die HTML-Elemente mit der App-Logik aus src/core.

import { createApp } from '../core/index.js';
import { renderBookList, renderStats } from './book-list.js';
import { createBookForm } from './book-form.js';

const $ = (id) => document.getElementById(id);
const app = createApp();
const form = createBookForm(app, $);

const TABS = {
  all: { title: 'Alle Bücher', empty: 'Noch keine Bücher. Tippe auf +, um eins hinzuzufügen.' },
  wishlist: { title: 'Wunschliste', empty: 'Deine Wunschliste ist leer.' },
  'unread-owned': { title: 'Im Regal', empty: 'Keine ungelesenen Bücher im Regal.' },
  read: { title: 'Gelesen', empty: 'Noch keine gelesenen Bücher.' },
  more: { title: 'Mehr' },
};
let currentTab = 'all';

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
  onToggleReading: (book) => run(() => app.books.toggleReading(book.id)),
  onToggleRead: (book) => run(() => app.books.toggleRead(book.id)),
  onOpen: (book) => form.open(book),
};

function render() {
  const isList = currentTab !== 'more';
  $('view-title').textContent = TABS[currentTab].title;
  $('list-view').hidden = !isList;
  $('more-view').hidden = isList;
  $('search').hidden = !isList;
  $('add-btn').hidden = !isList;
  renderStats($('stats'), app.books.stats());
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === currentTab));
  if (!isList) return;

  const query = $('search').value;
  const books = app.books.list({ filter: currentTab, query });
  renderBookList($('book-list'), books, listActions);
  $('empty').hidden = books.length > 0;
  $('empty-text').textContent = query ? 'Keine Treffer.' : TABS[currentTab].empty;
}

app.books.subscribe(render);
$('search').addEventListener('input', render);
$('add-btn').addEventListener('click', () => form.open());
$('tabbar').addEventListener('click', (e) => {
  const tab = e.target.closest('button')?.dataset.tab;
  if (!tab) return;
  currentTab = tab;
  window.scrollTo({ top: 0 });
  render();
});

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
    alert('Import erfolgreich.');
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
