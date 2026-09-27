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

function matchesFilter(book, filter) {
  switch (filter) {
    case 'read': return book.read;
    case 'unread-owned': return book.owned && !book.read;
    case 'not-owned': return !book.owned;
    default: return true;
  }
}

function render() {
  const query = $('search').value.trim().toLowerCase();
  const filter = $('filter').value;
  const visible = books
    .filter((b) => matchesFilter(b, filter))
    .filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(query))
    .sort((a, b) => a.title.localeCompare(b.title, 'de'));

  const list = $('book-list');
  list.replaceChildren(...visible.map(renderBook));
  $('empty').hidden = visible.length > 0;

  const read = books.filter((b) => b.read).length;
  const unreadOwned = books.filter((b) => b.owned && !b.read).length;
  $('stats').textContent =
    `${books.length} Bücher · ${read} gelesen · ${unreadOwned} im Regal ungelesen`;
}

function renderBook(book) {
  const li = document.createElement('li');

  const info = document.createElement('div');
  info.className = 'info';
  const title = document.createElement('strong');
  title.textContent = book.title;
  const author = document.createElement('span');
  author.textContent = book.author || '—';
  info.append(title, author);

  const tag = (label, on, key) => {
    const btn = document.createElement('button');
    btn.className = 'tag' + (on ? ' on' : '');
    btn.textContent = label;
    btn.title = 'Umschalten';
    btn.onclick = () => { book[key] = !book[key]; save(); render(); };
    return btn;
  };

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

  li.append(info, tag('Besitz', book.owned, 'owned'), tag('Gelesen', book.read, 'read'), actions);
  return li;
}

function startEdit(book) {
  $('book-id').value = book.id;
  $('title').value = book.title;
  $('author').value = book.author;
  $('owned').checked = book.owned;
  $('read').checked = book.read;
  $('submit-btn').textContent = 'Speichern';
  $('cancel-btn').hidden = false;
  $('title').focus();
}

function resetForm() {
  $('book-form').reset();
  $('book-id').value = '';
  $('submit-btn').textContent = 'Hinzufügen';
  $('cancel-btn').hidden = true;
}

$('book-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    title: $('title').value.trim(),
    author: $('author').value.trim(),
    owned: $('owned').checked,
    read: $('read').checked,
  };
  if (!data.title) return;

  const id = $('book-id').value;
  if (id) {
    Object.assign(books.find((b) => b.id === id), data);
  } else {
    books.push({ id: crypto.randomUUID(), addedAt: new Date().toISOString(), ...data });
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
