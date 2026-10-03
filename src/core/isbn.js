// ISBN-Hilfsfunktionen und die Suche nach Buchdaten über öffentliche Kataloge.

export const normalizeIsbn = (s) => String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase();
export const isValidIsbn = (isbn) => isbn.length === 10 || isbn.length === 13;

// Prüfziffer einer EAN-13 (ISBN-13) kontrollieren.
function hasValidEanChecksum(code) {
  const sum = [...code.slice(0, 12)].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

// Gescannter Barcode → ISBN-13, oder null, wenn es kein Buch-Barcode ist
// (z. B. Preis-Zusatzcode oder ein anderer Strichcode).
export function isbnFromBarcode(text) {
  const code = String(text || '').replace(/\D/g, '');
  if (code.length !== 13 || !/^97[89]/.test(code)) return null;
  return hasValidEanChecksum(code) ? code : null;
}

export function isbn13to10(isbn) {
  if (isbn.length === 10) return isbn;
  if (!isbn.startsWith('978')) return null;
  const core = isbn.slice(3, 12);
  const sum = [...core].reduce((acc, d, i) => acc + Number(d) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? 'X' : String(check));
}

// "XII, 320 Seiten" → 320
export function parsePages(text) {
  const str = String(text || '');
  const match = str.match(/(\d+)\s*(?:Seiten|S\.|p\.|pages)/i) || str.match(/\d+/);
  const pages = match ? Number(match[1] ?? match[0]) : NaN;
  return pages > 0 ? pages : null;
}

// "Kiyosaki, Robert T." → "Robert T. Kiyosaki"
const flipName = (name) => name.split(', ').reverse().join(' ');

async function fetchResponse(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(res.status === 429 ? 'Limit erreicht' : `HTTP ${res.status}`);
    return res;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Zeitüberschreitung');
    if (err instanceof TypeError) throw new Error('nicht erreichbar');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const fetchJson = async (url) => (await fetchResponse(url)).json();
const fetchText = async (url) => (await fetchResponse(url)).text();

// Jede Quelle liefert { title, author, pages?, cover? } oder null (nicht gefunden) und wirft bei Fehlern.
export const ISBN_SOURCES = [
  {
    name: 'Google Books',
    async lookup(isbn, { googleApiKey } = {}) {
      const key = googleApiKey ? `&key=${encodeURIComponent(googleApiKey)}` : '';
      const info = (await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key}`)).items?.[0]?.volumeInfo;
      if (!info?.title) return null;
      return {
        title: info.title,
        author: (info.authors || []).join(', '),
        pages: info.pageCount || null,
        cover: (info.imageLinks?.thumbnail || '').replace(/^http:/, 'https:') || null,
      };
    },
  },
  {
    // Deutsche Nationalbibliothek – enthält praktisch alle in Deutschland erschienenen Bücher.
    name: 'DNB',
    async lookup(isbn) {
      const url = 'https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve'
        + `&query=num%3D${isbn}&recordSchema=MARC21-xml&maximumRecords=1`;
      const xml = new DOMParser().parseFromString(await fetchText(url), 'application/xml');
      const record = xml.getElementsByTagNameNS('*', 'record')[0];
      if (!record) return null;
      const subfield = (tag, code) => {
        const field = [...record.getElementsByTagNameNS('*', 'datafield')].find((f) => f.getAttribute('tag') === tag);
        const sub = field && [...field.getElementsByTagNameNS('*', 'subfield')].find((s) => s.getAttribute('code') === code);
        // Nichtsortierzeichen und abschließende Katalog-Satzzeichen entfernen.
        return (sub?.textContent || '').replace(/[\u0098\u009c]/g, '').replace(/\s*[:/;,]\s*$/, '').trim();
      };
      const title = subfield('245', 'a');
      if (!title) return null;
      const author = subfield('100', 'a') || subfield('110', 'a');
      return { title, author: flipName(author), pages: parsePages(subfield('300', 'a')) };
    },
  },
  {
    name: 'Open Library',
    async lookup(isbn) {
      const url = `https://openlibrary.org/search.json?isbn=${isbn}&fields=title,author_name,number_of_pages_median&limit=1`;
      const doc = (await fetchJson(url)).docs?.[0];
      if (!doc?.title) return null;
      return { title: doc.title, author: (doc.author_name || []).join(', '), pages: doc.number_of_pages_median || null };
    },
  },
  {
    // Deutscher Bibliotheksverbund (hbz) – gut für deutschsprachige Bücher.
    name: 'lobid',
    async lookup(isbn) {
      const item = (await fetchJson(`https://lobid.org/resources/search?q=isbn:${isbn}&format=json&size=1`)).member?.[0];
      if (!item?.title) return null;
      const authors = (item.contribution || []).map((c) => c.agent?.label).filter(Boolean).map(flipName);
      const extent = Array.isArray(item.extent) ? item.extent[0] : item.extent;
      return { title: item.title, author: authors.join(', '), pages: parsePages(extent) };
    },
  },
];

// Fragt alle Quellen gleichzeitig ab und wählt das Ergebnis nach Reihenfolge der Quellen.
// Ergebnis: { found: true, source, book: { title, author, pages, cover } }
//        oder { found: false, details: [{ source, error }] }
export async function lookupIsbn(rawIsbn, options = {}, sources = ISBN_SOURCES) {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isValidIsbn(isbn)) throw new Error('Bitte eine gültige ISBN (10 oder 13 Stellen) eingeben.');

  const results = await Promise.allSettled(sources.map((s) => s.lookup(isbn, options)));
  const hit = results.findIndex((r) => r.status === 'fulfilled' && r.value);
  if (hit === -1) {
    return {
      found: false,
      details: results.map((r, i) => ({
        source: sources[i].name,
        error: r.status === 'rejected' ? r.reason.message : 'nicht gefunden',
      })),
    };
  }
  const book = { pages: null, cover: null, ...results[hit].value };
  // Fehlt die Seitenzahl in der gewählten Quelle, aus einer anderen übernehmen.
  book.pages ||= results.find((r) => r.status === 'fulfilled' && r.value?.pages)?.value.pages || null;
  return { found: true, source: sources[hit].name, book };
}
