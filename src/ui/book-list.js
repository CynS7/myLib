// Darstellung der Bücherliste. Aktionen werden über Callbacks nach außen gemeldet.

import { coverCandidates, isWishlist } from '../core/index.js';

const formatDate = (iso) => new Date(iso + 'T00:00').toLocaleDateString('de-DE');

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function renderCover(book) {
  const box = el('div', { className: 'cover' });
  const candidates = coverCandidates(book);
  if (!candidates.length) return box;

  // Einige Cover-Dienste blockieren Bilder, die von fremden Seiten eingebunden werden.
  const img = el('img', { alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' });
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

function renderBook(book, actions) {
  const meta = [book.author || '—', book.pages && `${book.pages} Seiten`, book.isbn && `ISBN ${book.isbn}`]
    .filter(Boolean).join(' · ');
  const info = el('div', { className: 'info' }, [
    el('strong', { textContent: book.title }),
    el('span', { textContent: meta }),
  ]);

  const tag = (label, on, onclick) =>
    el('button', { className: 'tag' + (on ? ' on' : ''), textContent: label, title: 'Umschalten', onclick });

  const badges = el('div', { className: 'badges' }, [
    ...(isWishlist(book) ? [el('span', { className: 'tag wish', textContent: 'Wunschliste' })] : []),
    tag('Besitz', book.owned, () => actions.onToggleOwned(book)),
    tag(book.read ? `Gelesen ${formatDate(book.readAt)}` : 'Gelesen', book.read, () => actions.onToggleRead(book)),
  ]);

  const buttons = el('div', { className: 'actions' }, [
    el('button', { textContent: '✏️', title: 'Bearbeiten', onclick: () => actions.onEdit(book) }),
    el('button', { textContent: '🗑️', title: 'Löschen', onclick: () => actions.onDelete(book) }),
  ]);

  return el('li', {}, [renderCover(book), info, badges, buttons]);
}

export function renderBookList(listEl, emptyEl, books, actions) {
  listEl.replaceChildren(...books.map((b) => renderBook(b, actions)));
  emptyEl.hidden = books.length > 0;
}

export function renderStats(statsEl, s) {
  statsEl.textContent =
    `${s.total} Bücher · ${s.wishlist} auf der Wunschliste · ${s.unreadOwned} im Regal ungelesen · ${s.read} gelesen`;
}
