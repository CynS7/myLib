// Formular zum Hinzufügen und Bearbeiten eines Buchs.

import { today } from '../core/index.js';

export function createBookForm(app, $) {
  const status = $('lookup-status');

  function showStatus(text) {
    status.hidden = false;
    status.textContent = text;
  }

  function reset() {
    $('book-form').reset();
    $('book-id').value = '';
    $('cover-url').value = '';
    $('edit-fields').hidden = true;
    status.hidden = true;
    $('submit-btn').textContent = 'Auf Wunschliste setzen';
    $('cancel-btn').hidden = true;
  }

  function edit(book) {
    $('book-id').value = book.id;
    $('isbn').value = book.isbn || '';
    $('cover-url').value = book.coverUrl || '';
    $('title').value = book.title;
    $('author').value = book.author;
    $('pages').value = book.pages || '';
    $('owned').checked = book.owned;
    $('read').checked = book.read;
    $('read-at').value = book.readAt || '';
    $('edit-fields').hidden = false;
    $('submit-btn').textContent = 'Speichern';
    $('cancel-btn').hidden = false;
    $('title').focus();
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
      coverUrl: $('cover-url').value,
    };
    const id = $('book-id').value;
    try {
      if (id) {
        app.books.update(id, {
          ...data,
          owned: $('owned').checked,
          read: $('read').checked,
          readAt: $('read-at').value || null,
        });
      } else {
        app.books.add(data);
      }
      reset();
    } catch (err) {
      alert(err.message);
    }
  }

  $('book-form').addEventListener('submit', submit);
  $('cancel-btn').addEventListener('click', reset);
  $('lookup-btn').addEventListener('click', lookup);
  $('isbn').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); lookup(); }
  });
  // Ein gespeichertes Cover gehört zur alten ISBN.
  $('isbn').addEventListener('input', () => { $('cover-url').value = ''; });
  $('read').addEventListener('change', () => {
    $('read-at').value = $('read').checked ? $('read-at').value || today() : '';
  });
  $('read-at').addEventListener('change', () => {
    $('read').checked = Boolean($('read-at').value);
  });

  return { edit, reset };
}
