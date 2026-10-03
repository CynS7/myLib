// Mögliche Cover-Adressen eines Buchs, in der Reihenfolge, in der sie ausprobiert werden sollen.

import { isbn13to10 } from './isbn.js';

export function coverCandidates(book) {
  if (!book.isbn) return [];
  const isbn10 = isbn13to10(book.isbn);
  return [
    book.coverUrl,
    `https://portal.dnb.de/opac/mvb/cover?isbn=${book.isbn}`,
    `https://www.buchhandel.de/cover/${book.isbn}/${book.isbn}-cover-m.jpg`,
    isbn10 && `https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`,
    `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg?default=false`,
  ].filter(Boolean);
}
