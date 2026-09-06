const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Ensure mock localStorage
function createMockLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(String(k), String(v)),
    removeItem: (k) => store.delete(String(k)),
    clear: () => store.clear()
  };
}
global.localStorage = createMockLocalStorage();

const StorageAdapter = require('../public/js/storage');
const BookmarksManager = require('../public/js/bookmarks');

test('BookmarksManager - Toggle and State Tracking', async (t) => {
  t.beforeEach(() => {
    global.localStorage = createMockLocalStorage();
    StorageAdapter.resetMemoryStore();
  });

  await t.test('detecta si un capítulo está marcado y alterna su estado', () => {
    const bookId = 42;
    const chapterId = 101;
    const chapterIndex = 2;

    assert.equal(BookmarksManager.isChapterBookmarked(bookId, chapterId), false);

    // Activar marcador
    const res1 = BookmarksManager.toggleBookmark(bookId, chapterIndex, chapterId, 'Mi marcador personalizado');
    assert.equal(res1.isBookmarked, true);
    assert.ok(res1.bookmark);
    assert.equal(res1.bookmark.label, 'Mi marcador personalizado');
    assert.equal(BookmarksManager.isChapterBookmarked(bookId, chapterId), true);

    // Desactivar marcador al volver a alternar sin nuevo label
    const res2 = BookmarksManager.toggleBookmark(bookId, chapterIndex, chapterId);
    assert.equal(res2.isBookmarked, false);
    assert.equal(BookmarksManager.isChapterBookmarked(bookId, chapterId), false);
  });

  await t.test('obtiene el marcador específico de un capítulo si existe', () => {
    const bookId = 7;
    BookmarksManager.toggleBookmark(bookId, 0, 15, 'Capítulo Uno');
    
    const bm = BookmarksManager.getBookmarkForChapter(bookId, 15);
    assert.ok(bm);
    assert.equal(bm.chapterId, 15);
    assert.equal(bm.label, 'Capítulo Uno');

    const notFound = BookmarksManager.getBookmarkForChapter(bookId, 999);
    assert.equal(notFound, null);
  });
});

test('UI Markup & CSS Integration Contracts', async (t) => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'public/css/styles.css'), 'utf8');

  await t.test('index.html contiene el botón de marcador en la barra superior del lector', () => {
    assert.match(html, /id="btn-reader-bookmark"/);
    assert.match(html, /aria-label="Marcar capítulo"/);
  });

  await t.test('index.html contiene el popover flotante de selección y notas', () => {
    assert.match(html, /id="reader-selection-popover"/);
    assert.match(html, /data-color="yellow"/);
    assert.match(html, /data-color="green"/);
    assert.match(html, /data-color="blue"/);
    assert.match(html, /data-color="pink"/);
    assert.match(html, /id="popover-note-input"/);
    assert.match(html, /id="btn-save-annotation"/);
  });

  await t.test('index.html contiene pestañas del drawer (Índice, Marcadores, Notas)', () => {
    assert.match(html, /data-drawer-tab="toc"/);
    assert.match(html, /data-drawer-tab="bookmarks"/);
    assert.match(html, /data-drawer-tab="notes"/);
    assert.match(html, /id="reader-bookmarks-list"/);
    assert.match(html, /id="reader-notes-list"/);
  });

  await t.test('styles.css contiene reglas de estilo para resaltados y temas de color', () => {
    assert.match(styles, /\.reader-highlight/);
    assert.match(styles, /\.highlight-yellow/);
    assert.match(styles, /\.highlight-green/);
    assert.match(styles, /\.highlight-blue/);
    assert.match(styles, /\.highlight-pink/);
    assert.match(styles, /\.reader-selection-popover/);
    assert.match(styles, /\.reader-drawer-tabs/);
  });
});
