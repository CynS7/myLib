// Fenster zum Hinzufügen, Ansehen und Bearbeiten eines Buchs.

import { LANGUAGES, languageOf, today } from '../core/index.js';
import { renderCover } from './book-list.js';
import { createScanner } from './scanner.js';

export function createBookForm(app, $) {
  const sheet = $('book-sheet');
  const scanner = createScanner($);

  // Auswahl der Lesesprache aus den Sprachen der Logik erzeugen.
  $('language-picker').replaceChildren(...Object.entries(LANGUAGES).map(([code, name]) => {
    const label = document.createElement('label');
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'language', value: code });
    label.append(input, Object.assign(document.createElement('span'), { textContent: name }));
    return label;
  }));
  const selectedLanguage = () => $('book-form').elements.language.value;
  const selectLanguage = (code) => { $('book-form').elements.language.value = code; };
  const status = $('lookup-status');

  function showStatus(text) {
    status.hidden = false;
    status.textContent = text;
  }

  // Vorschau aus den aktuellen Formularwerten.
  function updateCover() {
    const preview = { title: $('title').value, isbn: $('isbn').value.replace(/[^0-9Xx]/g, ''), coverUrl: $('cover-url').value };
    $('sheet-cover').replaceChildren(renderCover(preview, { large: true }));
  }

  function updateReadAt() {
    $('read-at-row').hidden = !$('read').checked;
  }

  function fill(book) {
    $('book-form').reset();
    $('book-id').value = book?.id || '';
    $('isbn').value = book?.isbn || '';
    $('cover-url').value = book?.coverUrl || '';
    $('title').value = book?.title || '';
    $('author').value = book?.author || '';
    $('pages').value = book?.pages || '';
    selectLanguage(languageOf(book || {}));
    $('owned').checked = Boolean(book?.owned);
    $('reading').checked = Boolean(book?.reading);
    $('read').checked = Boolean(book?.read);
    $('read-at').value = book?.readAt || '';
    status.hidden = true;

    const editing = Boolean(book);
    $('sheet-title').textContent = editing ? 'Buch' : 'Neues Buch';
    $('submit-btn').textContent = editing ? 'Sichern' : 'Hinzufügen';
    $('edit-fields').hidden = !editing;
    $('delete-btn').hidden = !editing;
    $('new-hint').hidden = editing;
    updateReadAt();
    updateCover();
  }

  function open(book = null) {
    fill(book);
    sheet.showModal();
    sheet.scrollTop = 0;
    if (!book) $('isbn').focus();
  }

  const close = () => sheet.close();

  // Barcode scannen, ISBN eintragen und direkt nachschlagen.
  async function scan() {
    try {
      const isbn = await scanner.scan();
      if (!isbn) return;
      $('isbn').value = isbn;
      $('cover-url').value = '';
      await lookup();
    } catch (err) {
      showStatus(err.message);
    }
  }

  // Neues Buch anlegen und gleich den Scanner öffnen.
  function openWithScan() {
    open();
    scan();
  }

  async function lookup() {
    showStatus('Suche …');
    $('lookup-btn').disabled = true;
    try {
      const result = await app.lookupIsbn($('isbn').value);
      if (!result.found) {
        const details = result.details.map((d) => `${d.source}: ${d.error}`).join(' · ');
        showStatus(`Kein Buch gefunden – bitte Titel und Autor selbst eintragen. (${details})`);
        return;
      }
      const { book } = result;
      $('title').value = book.title;
      $('author').value = book.author;
      $('pages').value = book.pages || '';
      $('cover-url').value = book.cover || '';
      showStatus(`Gefunden über ${result.source} ✓`);
      updateCover();
    } catch (err) {
      showStatus(err.message);
    } finally {
      $('lookup-btn').disabled = false;
    }
  }

  function submit(e) {
    e.preventDefault();
    const data = {
      isbn: $('isbn').value,
      title: $('title').value,
      author: $('author').value,
      pages: $('pages').value,
      language: selectedLanguage(),
      coverUrl: $('cover-url').value,
    };
    const id = $('book-id').value;
    try {
      if (id) {
        app.books.update(id, {
          ...data,
          owned: $('owned').checked,
          reading: $('reading').checked,
          read: $('read').checked,
          readAt: $('read-at').value || null,
        });
      } else {
        app.books.add(data);
      }
      close();
    } catch (err) {
      alert(err.message);
    }
  }

  function remove() {
    const id = $('book-id').value;
    const book = app.books.get(id);
    if (!book || !confirm(`„${book.title}“ löschen?`)) return;
    try {
      app.books.remove(id);
      close();
    } catch (err) {
      alert(err.message);
    }
  }

  $('book-form').addEventListener('submit', submit);
  $('cancel-btn').addEventListener('click', close);
  $('delete-btn').addEventListener('click', remove);
  $('lookup-btn').addEventListener('click', lookup);
  $('scan-btn').addEventListener('click', scan);
  $('scan-btn').hidden = !scanner.supported;
  $('isbn').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); lookup(); }
  });
  // Ein gespeichertes Cover gehört zur alten ISBN.
  $('isbn').addEventListener('input', () => { $('cover-url').value = ''; });
  $('isbn').addEventListener('change', updateCover);
  $('title').addEventListener('change', updateCover);
  // "Lese ich gerade" und "Gelesen" schließen sich gegenseitig aus.
  $('read').addEventListener('change', () => {
    if ($('read').checked) $('reading').checked = false;
    $('read-at').value = $('read').checked ? $('read-at').value || today() : '';
    updateReadAt();
  });
  $('reading').addEventListener('change', () => {
    if (!$('reading').checked) return;
    $('read').checked = false;
    $('read-at').value = '';
    updateReadAt();
  });
  // Tippen auf den abgedunkelten Hintergrund schließt das Fenster.
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });

  return { open, openWithScan, canScan: scanner.supported };
}
