// Bücherverwaltung: Datenmodell, Regeln und Speicherung. Kein Zugriff auf die Anzeige.
//
// Ein Buch sieht so aus:
// { id, addedAt, isbn, title, author, pages, coverUrl, owned, read, readAt }

import { normalizeIsbn } from './isbn.js';

const STORAGE_KEY = 'mylib.books';

export const FILTERS = {
  all: () => true,
  wishlist: (b) => isWishlist(b),
  'unread-owned': (b) => b.owned && !b.read,
  read: (b) => b.read,
};

export const isWishlist = (b) => !b.owned && !b.read;
export const today = () => new Date().toISOString().slice(0, 10);

function matchesSearch(book, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (`${book.title} ${book.author}`.toLowerCase().includes(q)) return true;
  const isbnQuery = normalizeIsbn(q);
  return isbnQuery.length > 0 && normalizeIsbn(book.isbn).includes(isbnQuery);
}

function cleanFields(data) {
  const fields = {};
  if ('isbn' in data) fields.isbn = normalizeIsbn(data.isbn);
  if ('title' in data) fields.title = String(data.title || '').trim();
  if ('author' in data) fields.author = String(data.author || '').trim();
  if ('pages' in data) fields.pages = Number(data.pages) > 0 ? Number(data.pages) : null;
  if ('coverUrl' in data) fields.coverUrl = data.coverUrl || null;
  if ('owned' in data) fields.owned = Boolean(data.owned);
  return fields;
}

export class BookStore {
  constructor(storage) {
    this.storage = storage;
    this.books = storage.getJson(STORAGE_KEY, []);
    this.listeners = new Set();
  }

  // Die Ansicht meldet sich hier an und wird nach jeder Änderung benachrichtigt.
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  #commit() {
    const saved = this.storage.setJson(STORAGE_KEY, this.books);
    this.listeners.forEach((l) => l());
    if (!saved) throw new Error('Speichern fehlgeschlagen.');
  }

  get(id) {
    return this.books.find((b) => b.id === id) || null;
  }

  list({ filter = 'all', query = '' } = {}) {
    const byFilter = FILTERS[filter] || FILTERS.all;
    return this.books
      .filter((b) => byFilter(b) && matchesSearch(b, query))
      .sort((a, b) => a.title.localeCompare(b.title, 'de'));
  }

  stats() {
    return {
      total: this.books.length,
      wishlist: this.books.filter(isWishlist).length,
      unreadOwned: this.books.filter(FILTERS['unread-owned']).length,
      read: this.books.filter(FILTERS.read).length,
    };
  }

  // Neue Bücher landen immer zuerst auf der Wunschliste.
  add(data) {
    const fields = cleanFields(data);
    if (!fields.title) throw new Error('Titel fehlt.');
    const book = {
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
      isbn: '',
      author: '',
      pages: null,
      coverUrl: null,
      ...fields,
      owned: false,
      read: false,
      readAt: null,
    };
    this.books.push(book);
    this.#commit();
    return book;
  }

  // data kann zusätzlich { read, readAt } enthalten.
  update(id, data) {
    const book = this.get(id);
    if (!book) throw new Error('Buch nicht gefunden.');
    const fields = cleanFields(data);
    if ('title' in fields && !fields.title) throw new Error('Titel fehlt.');
    Object.assign(book, fields);
    if ('read' in data) this.#applyRead(book, data.read, data.readAt);
    this.#commit();
    return book;
  }

  remove(id) {
    this.books = this.books.filter((b) => b.id !== id);
    this.#commit();
  }

  toggleOwned(id) {
    const book = this.get(id);
    return this.update(id, { owned: !book.owned });
  }

  toggleRead(id) {
    const book = this.get(id);
    return this.update(id, { read: !book.read });
  }

  #applyRead(book, read, readAt) {
    book.read = Boolean(read);
    book.readAt = book.read ? readAt || book.readAt || today() : null;
  }

  exportJson() {
    return JSON.stringify(this.books, null, 2);
  }

  importJson(text) {
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error('Ungültige Datei.');
    this.books = imported;
    this.#commit();
  }
}
