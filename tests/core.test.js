import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/core/index.js';
import { memoryBackend } from '../src/core/storage.js';
import { isbn13to10, lookupIsbn, normalizeIsbn, parsePages } from '../src/core/isbn.js';
import { coverCandidates } from '../src/core/covers.js';

test('neue Bücher landen auf der Wunschliste', () => {
  const { books } = createApp(memoryBackend());
  const book = books.add({ title: ' Dune ', author: 'Frank Herbert', isbn: '978-0-441-01359-3', pages: '600' });
  assert.equal(book.title, 'Dune');
  assert.equal(book.isbn, '9780441013593');
  assert.equal(book.pages, 600);
  assert.equal(book.owned, false);
  assert.equal(book.read, false);
  assert.deepEqual(books.stats(), { total: 1, wishlist: 1, reading: 0, unreadOwned: 0, read: 0 });
});

test('Titel ist Pflicht', () => {
  const { books } = createApp(memoryBackend());
  assert.throws(() => books.add({ title: '  ' }), /Titel/);
});

test('Besitz und Gelesen umschalten, Lesedatum wird gesetzt und entfernt', () => {
  const { books } = createApp(memoryBackend());
  const { id } = books.add({ title: 'A' });
  books.toggleOwned(id);
  books.toggleRead(id);
  assert.equal(books.get(id).owned, true);
  assert.match(books.get(id).readAt, /^\d{4}-\d{2}-\d{2}$/);
  books.update(id, { read: true, readAt: '2025-03-14' });
  assert.equal(books.get(id).readAt, '2025-03-14');
  books.toggleRead(id);
  assert.equal(books.get(id).readAt, null);
});

test('Filter und Suche (auch per ISBN)', () => {
  const { books } = createApp(memoryBackend());
  const a = books.add({ title: 'Der Hobbit', isbn: '9780261102217' });
  books.add({ title: 'Dune' });
  books.toggleOwned(a.id);
  assert.deepEqual(books.list({ filter: 'wishlist' }).map((b) => b.title), ['Dune']);
  assert.deepEqual(books.list({ filter: 'unread-owned' }).map((b) => b.title), ['Der Hobbit']);
  assert.deepEqual(books.list({ query: '0261102217' }).map((b) => b.title), ['Der Hobbit']);
  assert.deepEqual(books.list({ query: 'dun' }).map((b) => b.title), ['Dune']);
});

test('Daten bleiben gespeichert und lassen sich exportieren/importieren', () => {
  const backend = memoryBackend();
  createApp(backend).books.add({ title: 'A' });
  const reopened = createApp(backend).books;
  assert.equal(reopened.stats().total, 1);

  const other = createApp(memoryBackend()).books;
  other.importJson(reopened.exportJson());
  assert.equal(other.list()[0].title, 'A');
  assert.throws(() => other.importJson('{}'));
});

test('Ansicht wird bei Änderungen benachrichtigt', () => {
  const { books } = createApp(memoryBackend());
  let calls = 0;
  books.subscribe(() => calls++);
  const { id } = books.add({ title: 'A' });
  books.remove(id);
  assert.equal(calls, 2);
});

test('Google-Schlüssel wird gespeichert', () => {
  const backend = memoryBackend();
  createApp(backend).settings.googleApiKey = ' AIzaTEST ';
  assert.equal(createApp(backend).settings.googleApiKey, 'AIzaTEST');
});

test('ISBN-Hilfsfunktionen', () => {
  assert.equal(normalizeIsbn('978-3-690-66042-6'), '9783690660426');
  assert.equal(isbn13to10('9780261102217'), '0261102214');
  assert.equal(parsePages('XII, 320 Seiten'), 320);
  assert.equal(parsePages('245 p.'), 245);
  assert.equal(parsePages(''), null);
  assert.equal(coverCandidates({ isbn: '' }).length, 0);
  assert.equal(coverCandidates({ isbn: '9780261102217', coverUrl: 'x' })[0], 'x');
});

test('ISBN-Suche: Reihenfolge der Quellen, Seitenzahl ergänzen, Fehlerdetails', async () => {
  const sources = [
    { name: 'A', lookup: async () => { throw new Error('Limit erreicht'); } },
    { name: 'B', lookup: async () => ({ title: 'T', author: 'X' }) },
    { name: 'C', lookup: async () => ({ title: 'T2', author: 'Y', pages: 320 }) },
  ];
  const hit = await lookupIsbn('9783690660426', {}, sources);
  assert.equal(hit.source, 'B');
  assert.equal(hit.book.pages, 320);

  const miss = await lookupIsbn('9783690660426', {}, [sources[0], { name: 'D', lookup: async () => null }]);
  assert.equal(miss.found, false);
  assert.deepEqual(miss.details, [
    { source: 'A', error: 'Limit erreicht' },
    { source: 'D', error: 'nicht gefunden' },
  ]);

  await assert.rejects(() => lookupIsbn('123', {}, sources), /gültige ISBN/);
});

test('Lese ich: schließt Gelesen aus, nicht mehr auf der Wunschliste, steht oben', () => {
  const { books } = createApp(memoryBackend());
  books.add({ title: 'A' });
  const { id } = books.add({ title: 'B' });
  books.toggleReading(id);
  assert.equal(books.get(id).reading, true);
  assert.match(books.get(id).startedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(books.list({ filter: 'wishlist' }).map((b) => b.title), ['A']);
  assert.deepEqual(books.list({ filter: 'reading' }).map((b) => b.title), ['B']);
  assert.deepEqual(books.list().map((b) => b.title), ['B', 'A']);
  assert.equal(books.stats().reading, 1);

  books.toggleRead(id);
  assert.equal(books.get(id).reading, false);
  assert.equal(books.get(id).startedAt, null);
  assert.equal(books.get(id).read, true);

  books.toggleReading(id);
  assert.equal(books.get(id).read, false);
  assert.equal(books.get(id).readAt, null);
});

test('Sprache: Standard Deutsch, auf Englisch umstellbar, alte Einträge gelten als Deutsch', async () => {
  const { LANGUAGES, languageOf } = await import('../src/core/index.js');
  const { books } = createApp(memoryBackend());
  const { id } = books.add({ title: 'A' });
  assert.equal(books.get(id).language, 'de');
  books.update(id, { language: 'en' });
  assert.equal(books.get(id).language, 'en');
  books.update(id, { language: 'xx' });
  assert.equal(books.get(id).language, 'de');
  assert.equal(books.add({ title: 'B', language: 'en' }).language, 'en');
  assert.equal(languageOf({}), 'de');
  assert.equal(LANGUAGES.en, 'Englisch');
});
