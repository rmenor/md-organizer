// Adaptador de Almacenamiento Local con Namespace athenaeum:* y Fallback en Memoria
const StorageAdapter = (() => {
  const PREFIX_PROGRESS = 'athenaeum:progress:';
  const PREFIX_BOOKMARKS = 'athenaeum:bookmarks:';
  const PREFIX_ANNOTATIONS = 'athenaeum:annotations:';
  const LEGACY_PROGRESS_PREFIX = 'md_reader_progress_';

  const memoryStore = new Map();

  function getStorageItem(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(key);
        if (item !== null) return item;
      }
    } catch (_) {
      // Fallback to in-memory store if localStorage throws or is restricted
    }
    return memoryStore.has(key) ? memoryStore.get(key) : null;
  }

  function setStorageItem(key, value) {
    const strVal = String(value);
    memoryStore.set(key, strVal);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, strVal);
        return true;
      }
    } catch (_) {
      // QuotaExceededError or security block: value is maintained in memoryStore
    }
    return true;
  }

  function removeStorageItem(key) {
    memoryStore.delete(key);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (_) {}
  }

  function resetMemoryStore() {
    memoryStore.clear();
  }

  // --- Reading Progress ---

  function getProgress(bookId) {
    if (!bookId && bookId !== 0) return null;
    const key = `${PREFIX_PROGRESS}${bookId}`;
    const raw = getStorageItem(key);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (_) {
        return null;
      }
    }

    // Migración de claves legadas: md_reader_progress_<bookId>
    const legacyKey = `${LEGACY_PROGRESS_PREFIX}${bookId}`;
    const legacyRaw = getStorageItem(legacyKey);
    if (legacyRaw) {
      try {
        const legacyData = JSON.parse(legacyRaw);
        saveProgress(bookId, legacyData);
        removeStorageItem(legacyKey);
        return getProgress(bookId);
      } catch (_) {
        removeStorageItem(legacyKey);
      }
    }

    return null;
  }

  function saveProgress(bookId, progressData) {
    if (!bookId && bookId !== 0) return false;
    if (!progressData) return false;

    const data = {
      bookId: Number(bookId),
      chapterIndex: Number(progressData.chapterIndex || 0),
      chapterId: Number(progressData.chapterId || 0),
      scrollTop: Math.round(Number(progressData.scrollTop || 0)),
      updatedAt: Number(progressData.updatedAt || Date.now())
    };

    return setStorageItem(`${PREFIX_PROGRESS}${bookId}`, JSON.stringify(data));
  }

  // --- Bookmarks ---

  function getBookmarks(bookId) {
    if (!bookId && bookId !== 0) return [];
    const key = `${PREFIX_BOOKMARKS}${bookId}`;
    const raw = getStorageItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveBookmark(bookId, bookmark) {
    if (!bookId && bookId !== 0) return [];
    const list = getBookmarks(bookId);
    const now = Date.now();
    const id = bookmark.id || `bm_${now}_${Math.random().toString(36).slice(2, 7)}`;
    
    const record = {
      id,
      bookId: Number(bookId),
      chapterIndex: Number(bookmark.chapterIndex || 0),
      chapterId: Number(bookmark.chapterId || 0),
      label: String(bookmark.label || '').trim(),
      createdAt: Number(bookmark.createdAt || now)
    };

    const existingIndex = list.findIndex(b => b.id === id);
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.push(record);
    }

    setStorageItem(`${PREFIX_BOOKMARKS}${bookId}`, JSON.stringify(list));
    return list;
  }

  function removeBookmark(bookId, bookmarkId) {
    if (!bookId && bookId !== 0) return [];
    const list = getBookmarks(bookId).filter(b => b.id !== bookmarkId);
    setStorageItem(`${PREFIX_BOOKMARKS}${bookId}`, JSON.stringify(list));
    return list;
  }

  // --- Annotations ---

  function getAnnotations(bookId, chapterId = null) {
    if (!bookId && bookId !== 0) return [];
    const key = `${PREFIX_ANNOTATIONS}${bookId}`;
    const raw = getStorageItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
      if (chapterId !== null && chapterId !== undefined) {
        return list.filter(a => Number(a.chapterId) === Number(chapterId));
      }
      return list;
    } catch (_) {
      return [];
    }
  }

  function saveAnnotation(bookId, annotation) {
    if (!bookId && bookId !== 0) return [];
    const list = getAnnotations(bookId);
    const now = Date.now();
    const id = annotation.id || `ann_${now}_${Math.random().toString(36).slice(2, 7)}`;

    const record = {
      id,
      bookId: Number(bookId),
      chapterIndex: Number(annotation.chapterIndex || 0),
      chapterId: Number(annotation.chapterId || 0),
      text: String(annotation.text || ''),
      note: String(annotation.note || ''),
      color: annotation.color || 'yellow',
      selector: annotation.selector || {
        exact: annotation.text || '',
        prefix: '',
        suffix: '',
        startOffset: 0,
        endOffset: (annotation.text || '').length
      },
      createdAt: Number(annotation.createdAt || now),
      updatedAt: now
    };

    const existingIndex = list.findIndex(a => a.id === id);
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.push(record);
    }

    setStorageItem(`${PREFIX_ANNOTATIONS}${bookId}`, JSON.stringify(list));
    return list;
  }

  function updateAnnotation(bookId, annotationId, updates) {
    if (!bookId && bookId !== 0) return [];
    const list = getAnnotations(bookId);
    const index = list.findIndex(a => a.id === annotationId);
    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...updates,
        id: annotationId,
        bookId: Number(bookId),
        updatedAt: Date.now()
      };
      setStorageItem(`${PREFIX_ANNOTATIONS}${bookId}`, JSON.stringify(list));
    }
    return list;
  }

  function removeAnnotation(bookId, annotationId) {
    if (!bookId && bookId !== 0) return [];
    const list = getAnnotations(bookId).filter(a => a.id !== annotationId);
    setStorageItem(`${PREFIX_ANNOTATIONS}${bookId}`, JSON.stringify(list));
    return list;
  }

  return {
    getProgress,
    saveProgress,
    getBookmarks,
    saveBookmark,
    removeBookmark,
    getAnnotations,
    saveAnnotation,
    updateAnnotation,
    removeAnnotation,
    resetMemoryStore
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageAdapter;
}
if (typeof window !== 'undefined') {
  window.StorageAdapter = StorageAdapter;
}
