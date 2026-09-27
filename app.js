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

  li.append(info, badges, actions);
  return li;
}

function startEdit(book) {
  $('book-id').value = book.id;
  $('isbn').value = book.isbn || '';
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
  $('edit-fields').hidden = true;
  $('lookup-status').hidden = true;
  $('submit-btn').textContent = 'Auf Wunschliste setzen';
  $('cancel-btn').hidden = true;
}

async function lookupGoogle(isbn) {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  if (!res.ok) return null;
  const info = (await res.json()).items?.[0]?.volumeInfo;
  return info && { title: info.title, author: (info.authors || []).join(', ') };
}

async function lookupOpenLibrary(isbn) {
  const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
  if (!res.ok) return null;
  const info = (await res.json())[`ISBN:${isbn}`];
  return info && { title: info.title, author: (info.authors || []).map((a) => a.name).join(', ') };
}

async function lookupIsbn() {
  const isbn = normalizeIsbn($('isbn').value);
  const status = $('lookup-status');
  status.hidden = false;
  if (isbn.length !== 10 && isbn.length !== 13) {
    status.textContent = 'Bitte eine gültige ISBN (10 oder 13 Stellen) eingeben.';
    return;
  }
  status.textContent = 'Suche …';
  let found = null;
  for (const lookup of [lookupGoogle, lookupOpenLibrary]) {
    try {
      found = await lookup(isbn);
    } catch {
      found = null;
    }
    if (found) break;
  }
  if (!found) {
    status.textContent = 'Kein Buch zu dieser ISBN gefunden – bitte Titel und Autor selbst eintragen.';
    return;
  }
  $('title').value = found.title;
  $('author').value = found.author;
  status.textContent = 'Gefunden ✓';
}

$('lookup-btn').addEventListener('click', lookupIsbn);
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
    Object.assign(book, data, { owned: $('owned').checked });
    setRead(book, $('read').checked);
    if (book.read && $('read-at').value) book.readAt = $('read-at').value;
  } else {
    // Neue Bücher landen immer zuerst auf der Wunschliste.
    books.push({
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
      ...data,
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
