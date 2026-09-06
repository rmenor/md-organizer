const test = require('node:test');
const assert = require('node:assert/strict');

// Mock localStorage for Node.js test environment
function createMockLocalStorage(options = {}) {
  const store = new Map();
  return {
    _store: store,
    _shouldThrowOnSet: options.throwOnSet || false,
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      if (this._shouldThrowOnSet) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    }
  };
}

// Ensure mock localStorage exists globally before loading module if needed
global.localStorage = createMockLocalStorage();

const StorageAdapter = require('../public/js/storage');

test('StorageAdapter - Reading Progress', async (t) => {
  t.beforeEach(() => {
    global.localStorage = createMockLocalStorage();
    StorageAdapter.resetMemoryStore();
  });

  await t.test('guarda y recupera el progreso de lectura con clave athenaeum:progress:<bookId>', () => {
    const bookId = 10;
    const progress = {
      chapterIndex: 2,
      chapterId: 42,
      scrollTop: 350
    };

    const saved = StorageAdapter.saveProgress(bookId, progress);
    assert.equal(saved, true);

    const loaded = StorageAdapter.getProgress(bookId);
    assert.ok(loaded);
    assert.equal(loaded.bookId, 10);
    assert.equal(loaded.chapterIndex, 2);
    assert.equal(loaded.chapterId, 42);
    assert.equal(loaded.scrollTop, 350);
    assert.ok(typeof loaded.updatedAt === 'number');

    // Comprobar que en localStorage está almacenado en athenaeum:progress:10
    const raw = global.localStorage.getItem('athenaeum:progress:10');
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    assert.equal(parsed.chapterId, 42);
  });

  await t.test('migra automáticamente claves legadas md_reader_progress_<bookId> al leer progreso', () => {
    const bookId = 25;
    const legacyData = {
      bookId: 25,
      chapterIndex: 1,
      chapterId: 101,
      scrollTop: 520,
      updatedAt: 1700000000000
    };
    global.localStorage.setItem(`md_reader_progress_${bookId}`, JSON.stringify(legacyData));

    // Al llamar a getProgress debe detectar y migrar
    const progress = StorageAdapter.getProgress(bookId);
    assert.ok(progress);
    assert.equal(progress.chapterIndex, 1);
    assert.equal(progress.chapterId, 101);
    assert.equal(progress.scrollTop, 520);

    // Debe existir en athenaeum:progress:25 y haberse eliminado la clave antigua
    assert.ok(global.localStorage.getItem('athenaeum:progress:25'));
    assert.equal(global.localStorage.getItem('md_reader_progress_25'), null);
  });

  await t.test('retorna null cuando no existe progreso previo', () => {
    const progress = StorageAdapter.getProgress(999);
    assert.equal(progress, null);
  });
});

test('StorageAdapter - Bookmarks', async (t) => {
  t.beforeEach(() => {
    global.localStorage = createMockLocalStorage();
    StorageAdapter.resetMemoryStore();
  });

  await t.test('guarda, lista y elimina marcadores por libro', () => {
    const bookId = 1;
    const bookmark1 = {
      chapterIndex: 0,
      chapterId: 10,
      label: 'Introducción a refactoring'
    };

    const list1 = StorageAdapter.saveBookmark(bookId, bookmark1);
    assert.equal(list1.length, 1);
    assert.ok(list1[0].id.startsWith('bm_'));
    assert.equal(list1[0].bookId, 1);
    assert.equal(list1[0].label, 'Introducción a refactoring');
    assert.ok(list1[0].createdAt > 0);

    const bookmark2 = {
      chapterIndex: 3,
      chapterId: 13,
      label: 'Reglas de Clean Code'
    };
    const list2 = StorageAdapter.saveBookmark(bookId, bookmark2);
    assert.equal(list2.length, 2);

    const retrieved = StorageAdapter.getBookmarks(bookId);
    assert.equal(retrieved.length, 2);

    // Eliminar el primer marcador
    const listAfterDelete = StorageAdapter.removeBookmark(bookId, list1[0].id);
    assert.equal(listAfterDelete.length, 1);
    assert.equal(listAfterDelete[0].chapterId, 13);

    const recheck = StorageAdapter.getBookmarks(bookId);
    assert.equal(recheck.length, 1);
  });

  await t.test('actualiza marcador existente si se pasa el mismo ID o capítulo', () => {
    const bookId = 2;
    const bm = StorageAdapter.saveBookmark(bookId, {
      chapterIndex: 1,
      chapterId: 20,
      label: 'Capítulo 2'
    });
    const bmId = bm[0].id;

    const updated = StorageAdapter.saveBookmark(bookId, {
      id: bmId,
      chapterIndex: 1,
      chapterId: 20,
      label: 'Capítulo 2 - Actualizado'
    });
    assert.equal(updated.length, 1);
    assert.equal(updated[0].label, 'Capítulo 2 - Actualizado');
  });
});

test('StorageAdapter - Annotations', async (t) => {
  t.beforeEach(() => {
    global.localStorage = createMockLocalStorage();
    StorageAdapter.resetMemoryStore();
  });

  await t.test('guarda, filtra por capítulo, actualiza y elimina anotaciones', () => {
    const bookId = 5;
    const ann1 = {
      chapterIndex: 0,
      chapterId: 100,
      text: 'Código limpio hace una sola cosa',
      note: 'Principio SRP',
      color: 'yellow',
      selector: {
        exact: 'Código limpio hace una sola cosa',
        prefix: 'Como regla, ',
        suffix: ' y la hace bien.',
        startOffset: 12,
        endOffset: 45
      }
    };

    const list1 = StorageAdapter.saveAnnotation(bookId, ann1);
    assert.equal(list1.length, 1);
    const annId = list1[0].id;
    assert.ok(annId.startsWith('ann_'));
    assert.equal(list1[0].color, 'yellow');
    assert.equal(list1[0].note, 'Principio SRP');

    const ann2 = {
      chapterIndex: 1,
      chapterId: 101,
      text: 'Nombres con significado',
      note: 'Capítulo 2',
      color: 'green',
      selector: {
        exact: 'Nombres con significado',
        prefix: '',
        suffix: '',
        startOffset: 0,
        endOffset: 23
      }
    };
    StorageAdapter.saveAnnotation(bookId, ann2);

    // Obtener todas las anotaciones del libro
    const all = StorageAdapter.getAnnotations(bookId);
    assert.equal(all.length, 2);

    // Filtrar por chapterId
    const chapter100 = StorageAdapter.getAnnotations(bookId, 100);
    assert.equal(chapter100.length, 1);
    assert.equal(chapter100[0].chapterId, 100);

    // Actualizar nota de ann1
    const updatedList = StorageAdapter.updateAnnotation(bookId, annId, {
      note: 'Principio SRP actualizado',
      color: 'blue'
    });
    const updatedAnn = updatedList.find(a => a.id === annId);
    assert.equal(updatedAnn.note, 'Principio SRP actualizado');
    assert.equal(updatedAnn.color, 'blue');
    assert.ok(updatedAnn.updatedAt >= updatedAnn.createdAt);

    // Eliminar anotación
    const afterDelete = StorageAdapter.removeAnnotation(bookId, annId);
    assert.equal(afterDelete.length, 1);
    assert.equal(afterDelete[0].chapterId, 101);
  });
});

test('StorageAdapter - In-Memory Fallback on Storage Failure', async (t) => {
  t.beforeEach(() => {
    // Simular error en localStorage (quota exceeded o modo privado)
    global.localStorage = createMockLocalStorage({ throwOnSet: true });
    StorageAdapter.resetMemoryStore();
  });

  await t.test('guarda y recupera progreso en memoria cuando localStorage arroja error', () => {
    const bookId = 99;
    const progress = {
      chapterIndex: 4,
      chapterId: 88,
      scrollTop: 600
    };

    const saved = StorageAdapter.saveProgress(bookId, progress);
    assert.equal(saved, true);

    const loaded = StorageAdapter.getProgress(bookId);
    assert.ok(loaded);
    assert.equal(loaded.chapterId, 88);
    assert.equal(loaded.scrollTop, 600);
  });

  await t.test('guarda y recupera marcadores y anotaciones en memoria cuando localStorage falla', () => {
    const bookId = 99;
    const bm = StorageAdapter.saveBookmark(bookId, {
      chapterIndex: 0,
      chapterId: 1,
      label: 'Fallback Bookmark'
    });
    assert.equal(bm.length, 1);
    assert.equal(StorageAdapter.getBookmarks(bookId).length, 1);

    const ann = StorageAdapter.saveAnnotation(bookId, {
      chapterIndex: 0,
      chapterId: 1,
      text: 'Highlighted text',
      note: 'Fallback Note',
      color: 'pink'
    });
    assert.equal(ann.length, 1);
    assert.equal(StorageAdapter.getAnnotations(bookId).length, 1);
  });
});
