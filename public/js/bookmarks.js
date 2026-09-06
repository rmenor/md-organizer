// Gestor de Marcadores de Capítulos
const BookmarksManager = (() => {
  function getAdapter() {
    if (typeof StorageAdapter !== 'undefined') {
      return StorageAdapter;
    }
    if (typeof require !== 'undefined') {
      return require('./storage');
    }
    throw new Error('StorageAdapter no está disponible');
  }

  function getBookmarks(bookId) {
    return getAdapter().getBookmarks(bookId);
  }

  function isChapterBookmarked(bookId, chapterId) {
    if (!bookId || !chapterId) return false;
    const list = getBookmarks(bookId);
    return list.some(b => Number(b.chapterId) === Number(chapterId));
  }

  function getBookmarkForChapter(bookId, chapterId) {
    if (!bookId || !chapterId) return null;
    const list = getBookmarks(bookId);
    const found = list.find(b => Number(b.chapterId) === Number(chapterId));
    return found || null;
  }

  function toggleBookmark(bookId, chapterIndex, chapterId, label = null) {
    const adapter = getAdapter();
    const existing = getBookmarkForChapter(bookId, chapterId);

    if (existing) {
      if (label !== null && label !== undefined && label.trim() !== '' && label.trim() !== existing.label) {
        // Actualizar etiqueta
        const updatedList = adapter.saveBookmark(bookId, {
          ...existing,
          label: label.trim()
        });
        const updated = updatedList.find(b => b.id === existing.id);
        return { isBookmarked: true, bookmark: updated, bookmarks: updatedList };
      } else {
        // Eliminar marcador
        const updatedList = adapter.removeBookmark(bookId, existing.id);
        return { isBookmarked: false, bookmark: null, bookmarks: updatedList };
      }
    }

    // Crear nuevo marcador
    const defaultLabel = label && label.trim() ? label.trim() : `Capítulo ${Number(chapterIndex) + 1}`;
    const newBm = {
      bookId: Number(bookId),
      chapterIndex: Number(chapterIndex),
      chapterId: Number(chapterId),
      label: defaultLabel
    };

    const updatedList = adapter.saveBookmark(bookId, newBm);
    const created = updatedList.find(b => Number(b.chapterId) === Number(chapterId) && b.label === defaultLabel) || updatedList[updatedList.length - 1];

    return { isBookmarked: true, bookmark: created, bookmarks: updatedList };
  }

  function removeBookmark(bookId, bookmarkId) {
    return getAdapter().removeBookmark(bookId, bookmarkId);
  }

  return {
    getBookmarks,
    isChapterBookmarked,
    getBookmarkForChapter,
    toggleBookmark,
    removeBookmark
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookmarksManager;
}
if (typeof window !== 'undefined') {
  window.BookmarksManager = BookmarksManager;
}
