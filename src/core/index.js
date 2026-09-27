// Einstiegspunkt der App-Logik. Die Ansicht importiert nur von hier.

import { createStorage } from './storage.js';
import { BookStore } from './books.js';
import { Settings } from './settings.js';
import { lookupIsbn } from './isbn.js';

export { FILTERS, isWishlist, today } from './books.js';
export { coverCandidates } from './covers.js';
export { normalizeIsbn } from './isbn.js';

export function createApp(backend) {
  const storage = createStorage(backend);
  const books = new BookStore(storage);
  const settings = new Settings(storage);
  return {
    books,
    settings,
    lookupIsbn: (isbn) => lookupIsbn(isbn, { googleApiKey: settings.googleApiKey }),
  };
}
