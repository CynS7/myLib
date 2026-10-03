// Darstellung der Bücherliste als Karten. Aktionen werden über Callbacks nach außen gemeldet.

import { LANGUAGES, coverCandidates, isWishlist, languageOf } from '../core/index.js';

const formatDate = (iso) => new Date(iso + 'T00:00').toLocaleDateString('de-DE');

export function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// Cover mit Anfangsbuchstaben als Platzhalter, bis ein Bild geladen ist.
export function renderCover(book, { large = false } = {}) {
  const box = el('div', { className: 'cover' + (large ? ' large' : '') }, [
    el('span', { className: 'cover-initial', textContent: (book.title || '?').trim().charAt(0).toUpperCase() }),
  ]);
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

function renderCard(book, actions) {
  const chip = (label, on, onClick, variant = '') =>
    el('button', {
      type: 'button',
      className: ['chip', variant, on && 'on'].filter(Boolean).join(' '),
      textContent: label,
      onclick: (e) => { e.stopPropagation(); onClick(); },
    });

  // Deutsch ist der Standard und wird nicht extra angezeigt.
  const language = languageOf(book);
  const meta = [
    language !== 'de' && `🇬🇧 ${LANGUAGES[language]}`,
    book.pages && `${book.pages} Seiten`,
    book.reading && book.startedAt && `liest seit ${formatDate(book.startedAt)}`,
    book.read && book.readAt && `gelesen am ${formatDate(book.readAt)}`,
  ]
    .filter(Boolean).join(' · ');

  const body = el('div', { className: 'card-body' }, [
    el('p', { className: 'card-title', textContent: book.title }),
    el('p', { className: 'card-author', textContent: book.author || 'Unbekannter Autor' }),
    ...(meta ? [el('p', { className: 'card-meta', textContent: meta })] : []),
    el('div', { className: 'chips' }, [
      ...(isWishlist(book) ? [el('span', { className: 'chip wish', textContent: '⭐ Wunschliste' })] : []),
      chip(book.owned ? '✓ Besitz' : 'Besitz', book.owned, () => actions.onToggleOwned(book)),
      chip(book.reading ? '📖 Lese ich' : 'Lese ich', book.reading, () => actions.onToggleReading(book), 'reading'),
      chip(book.read ? '✓ Gelesen' : 'Gelesen', book.read, () => actions.onToggleRead(book)),
    ]),
  ]);

  const className = 'card' + (book.reading ? ' is-reading' : '');
  return el('li', { className, onclick: () => actions.onOpen(book) }, [renderCover(book), body]);
}

export function renderBookList(listEl, books, actions) {
  listEl.replaceChildren(...books.map((b) => renderCard(b, actions)));
}

export function renderStats(statsEl, s) {
  statsEl.textContent = [
    `${s.total} Bücher`,
    s.reading && `${s.reading} am Lesen`,
    `${s.wishlist} Wunsch`,
    `${s.unreadOwned} im Regal`,
    `${s.read} gelesen`,
  ].filter(Boolean).join(' · ');
}
