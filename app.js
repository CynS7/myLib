const STORAGE_KEY = 'mylib.books';

const $ = (id) => document.getElementById(id);
let books = load();

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch {
    alert('Speichern fehlgeschlagen.');
  }
}

const today = () => new Date().toISOString().slice(0, 10);
const normalizeIsbn = (s) => (s || '').replace(/[^0-9Xx]/g, '').toUpperCase();
const formatDate = (iso) => new Date(iso + 'T00:00').toLocaleDateString('de-DE');
const isWishlist = (b) => !b.owned && !b.read;

function matchesFilter(book, filter) {
  switch (filter) {
    case 'wishlist': return isWishlist(book);
    case 'unread-owned': return book.owned && !book.read;
    case 'read': return book.read;
    default: return true;
  }
}

function matchesSearch(book, query) {
  if (!query) return true;
  if (`${book.title} ${book.author}`.toLowerCase().includes(query)) return true;
  const isbnQuery = normalizeIsbn(query);
  return isbnQuery.length > 0 && normalizeIsbn(book.isbn).includes(isbnQuery);
}

function render() {
  const query = $('search').value.trim().toLowerCase();
  const filter = $('filter').value;
  const visible = books
    .filter((b) => matchesFilter(b, filter) && matchesSearch(b, query))
    .sort((a, b) => a.title.localeCompare(b.title, 'de'));

  $('book-list').replaceChildren(...visible.map(renderBook));
  $('empty').hidden = visible.length > 0;

  const wish = books.filter(isWishlist).length;
  const read = books.filter((b) => b.read).length;
  const unreadOwned = books.filter((b) => b.owned && !b.read).length;
  $('stats').textContent =
    `${books.length} Bücher · ${wish} auf der Wunschliste · ${unreadOwned} im Regal ungelesen · ${read} gelesen`;
}

function setRead(book, read) {
  book.read = read;
  book.readAt = read ? book.readAt || today() : null;
}

// Mögliche Cover-Adressen, in dieser Reihenfolge ausprobiert.
function coverCandidates(book) {
  if (!book.isbn) return [];
  return [
    book.coverUrl,
    `https://portal.dnb.de/opac/mvb/cover?isbn=${book.isbn}`,
    `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg?default=false`,
  ].filter(Boolean);
}

function renderCover(book) {
  const box = document.createElement('div');
  box.className = 'cover';
  const candidates = coverCandidates(book);
  if (!candidates.length) return box;

  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  let i = 0;
  const next = () => {
    if (i < candidates.length) img.src = candidates[i++];
    else img.remove();
  };
  img.onerror = next;
  // Manche Dienste liefern statt eines Fehlers ein winziges Platzhalterbild.
  img.onload = () => {
    if (img.naturalWidth < 10) next();
    else box.classList.add('loaded');
  };
  next();
  box.append(img);
  return box;
}

function renderBook(book) {
  const li = document.createElement('li');

  const info = document.createElement('div');
  info.className = 'info';
  const title = document.createElement('strong');
  title.textContent = book.title;
  const meta = document.createElement('span');
  meta.textContent = [book.author || '—', book.isbn && `ISBN ${book.isbn}`].filter(Boolean).join(' · ');
  info.append(title, meta);

  const tag = (label, on, onClick) => {
    const btn = document.createElement('button');
    btn.className = 'tag' + (on ? ' on' : '');
    btn.textContent = label;
    btn.title = 'Umschalten';
    btn.onclick = () => { onClick(); save(); render(); };
    return btn;
  };

  const badges = document.createElement('div');
  badges.className = 'badges';
  if (isWishlist(book)) {
    const wish = document.createElement('span');
    wish.className = 'tag wish';
    wish.textContent = 'Wunschliste';
    badges.append(wish);
  }
  badges.append(
    tag('Besitz', book.owned, () => { book.owned = !book.owned; }),
    tag(book.read ? `Gelesen ${formatDate(book.readAt)}` : 'Gelesen', book.read, () => setRead(book, !book.read)),
  );

  const actions = document.createElement('div');
  actions.className = 'actions';
  const edit = document.createElement('button');
  edit.textContent = '✏️';
  edit.title = 'Bearbeiten';
  edit.onclick = () => startEdit(book);
  const del = document.createElement('button');
  del.textContent = '🗑️';
  del.title = 'Löschen';
  del.onclick = () => {
    if (!confirm(`„${book.title}“ löschen?`)) return;
    books = books.filter((b) => b.id !== book.id);
    save();
    render();
  };
  actions.append(edit, del);

  li.append(renderCover(book), info, badges, actions);
  return li;
}

function startEdit(book) {
  $('book-id').value = book.id;
  $('isbn').value = book.isbn || '';
  $('cover-url').value = book.coverUrl || '';
  $('title').value = book.title;
  $('author').value = book.author;
  $('owned').checked = book.owned;
  $('read').checked = book.read;
  $('read-at').value = book.readAt || '';
  $('edit-fields').hidden = false;
  $('submit-btn').textContent = 'Speichern';
  $('cancel-btn').hidden = false;
  $('title').focus();
}

function resetForm() {
  $('book-form').reset();
  $('book-id').value = '';
  $('cover-url').value = '';
  $('edit-fields').hidden = true;
  $('lookup-status').hidden = true;
  $('submit-btn').textContent = 'Auf Wunschliste setzen';
  $('cancel-btn').hidden = true;
}

// Jede Quelle liefert { title, author } oder null (nicht gefunden) und wirft bei Fehlern.
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

const ISBN_SOURCES = [
  {
    name: 'Google Books',
    async lookup(isbn) {
      const info = (await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)).items?.[0]?.volumeInfo;
      if (!info?.title) return null;
      const cover = (info.imageLinks?.thumbnail || '').replace(/^http:/, 'https:');
      return { title: info.title, author: (info.authors || []).join(', '), cover };
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
      return { title, author: author.split(', ').reverse().join(' ') };
    },
  },
  {
    name: 'Open Library',
    async lookup(isbn) {
      const doc = (await fetchJson(`https://openlibrary.org/search.json?isbn=${isbn}&fields=title,author_name&limit=1`)).docs?.[0];
      return doc?.title ? { title: doc.title, author: (doc.author_name || []).join(', ') } : null;
    },
  },
  {
    // Deutscher Bibliotheksverbund (hbz) – gut für deutschsprachige Bücher.
    name: 'lobid',
    async lookup(isbn) {
      const item = (await fetchJson(`https://lobid.org/resources/search?q=isbn:${isbn}&format=json&size=1`)).member?.[0];
      if (!item?.title) return null;
      const authors = (item.contribution || [])
        .map((c) => c.agent?.label)
        .filter(Boolean)
        .map((name) => name.split(', ').reverse().join(' '));
      return { title: item.title, author: authors.join(', ') };
    },
  },
];

async function lookupIsbn() {
  const isbn = normalizeIsbn($('isbn').value);
  const status = $('lookup-status');
  status.hidden = false;
  if (isbn.length !== 10 && isbn.length !== 13) {
    status.textContent = 'Bitte eine gültige ISBN (10 oder 13 Stellen) eingeben.';
    return;
  }
  status.textContent = 'Suche …';
  $('lookup-btn').disabled = true;

  // Alle Quellen gleichzeitig abfragen, Ergebnis nach Reihenfolge der Quellen wählen.
  const results = await Promise.allSettled(ISBN_SOURCES.map((s) => s.lookup(isbn)));
  $('lookup-btn').disabled = false;

  const hit = results.findIndex((r) => r.status === 'fulfilled' && r.value);
  if (hit === -1) {
    const details = results
      .map((r, i) => `${ISBN_SOURCES[i].name}: ${r.status === 'rejected' ? r.reason.message : 'nicht gefunden'}`)
      .join(' · ');
    status.textContent = `Kein Buch gefunden – bitte Titel und Autor selbst eintragen. (${details})`;
    return;
  }
  const found = results[hit].value;
  $('title').value = found.title;
  $('author').value = found.author;
  $('cover-url').value = found.cover || '';
  status.textContent = `Gefunden über ${ISBN_SOURCES[hit].name} ✓`;
}

$('lookup-btn').addEventListener('click', lookupIsbn);
// Ein gespeichertes Cover gehört zur alten ISBN.
$('isbn').addEventListener('input', () => { $('cover-url').value = ''; });
$('isbn').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); lookupIsbn(); }
});

$('read').addEventListener('change', () => {
  $('read-at').value = $('read').checked ? $('read-at').value || today() : '';
});
$('read-at').addEventListener('change', () => {
  $('read').checked = Boolean($('read-at').value);
});

$('book-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    isbn: normalizeIsbn($('isbn').value),
    title: $('title').value.trim(),
    author: $('author').value.trim(),
  };
  if (!data.title) return;

  const id = $('book-id').value;
  if (id) {
    const book = books.find((b) => b.id === id);
    Object.assign(book, data, { owned: $('owned').checked, coverUrl: $('cover-url').value || null });
    setRead(book, $('read').checked);
    if (book.read && $('read-at').value) book.readAt = $('read-at').value;
  } else {
    // Neue Bücher landen immer zuerst auf der Wunschliste.
    books.push({
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
      ...data,
      coverUrl: $('cover-url').value || null,
      owned: false,
      read: false,
      readAt: null,
    });
  }
  save();
  resetForm();
  render();
});

$('cancel-btn').addEventListener('click', resetForm);
$('search').addEventListener('input', render);
$('filter').addEventListener('change', render);

$('export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(books, null, 2)], { type: 'application/json' });
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
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error();
    books = imported;
    save();
    render();
  } catch {
    alert('Ungültige Datei.');
  }
  e.target.value = '';
});

render();

// Als App installierbar und offline nutzbar machen.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// Den Browser bitten, die gespeicherten Bücher nicht automatisch zu löschen.
navigator.storage?.persist?.().catch(() => {});
