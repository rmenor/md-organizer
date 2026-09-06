const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { compareSemVer } = require('./semver');


const DB_PATH = process.env.DB_PATH || (process.env.VERCEL ? path.join('/tmp', 'library.db') : path.join(__dirname, '..', 'library.db'));

// Asegurar directorio para la base de datos si es necesario
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = new Database(DB_PATH);

// Configuración de rendimiento y restricciones
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

let insertBookStmt;
let insertChapterStmt;
let insertVersionStmt;

function prepareStatements() {
  insertBookStmt = db.prepare(`
    INSERT INTO books (subsection_id, code, title, slug, version, publication_date, author, description, cover_image, storage_path, total_chapters, checksum, state, changelog)
    VALUES (@subsection_id, @code, @title, @slug, @version, @publication_date, @author, @description, @cover_image, @storage_path, @total_chapters, @checksum, @state, @changelog)
  `);

  insertChapterStmt = db.prepare(`
    INSERT INTO chapters (book_id, title, order_index, file_name, relative_path, word_count, checksum)
    VALUES (@book_id, @title, @order_index, @file_name, @relative_path, @word_count, @checksum)
  `);

  insertVersionStmt = db.prepare(`
    INSERT INTO book_versions (book_id, code, version, publication_date, state, changelog, checksum, storage_path, total_chapters, chapters_manifest)
    VALUES (@book_id, @code, @version, @publication_date, @state, @changelog, @checksum, @storage_path, @total_chapters, @chapters_manifest)
    ON CONFLICT(code, version) DO UPDATE SET
      publication_date = excluded.publication_date,
      state = excluded.state,
      changelog = excluded.changelog,
      checksum = excluded.checksum,
      storage_path = excluded.storage_path,
      total_chapters = excluded.total_chapters,
      chapters_manifest = excluded.chapters_manifest
  `);
}

// Inicialización de esquemas
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subsections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(section_id, slug)
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subsection_id INTEGER NOT NULL REFERENCES subsections(id) ON DELETE CASCADE,
      code TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0.0',
      publication_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      author TEXT DEFAULT 'Desconocido',
      description TEXT DEFAULT '',
      cover_image TEXT DEFAULT '',
      storage_path TEXT NOT NULL,
      total_chapters INTEGER DEFAULT 0,
      checksum TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'published',
      changelog TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      word_count INTEGER DEFAULT 0,
      checksum TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS book_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      version TEXT NOT NULL,
      publication_date TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'published',
      changelog TEXT DEFAULT '',
      checksum TEXT NOT NULL DEFAULT '',
      storage_path TEXT NOT NULL,
      total_chapters INTEGER DEFAULT 0,
      chapters_manifest TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(code, version)
    );

    CREATE INDEX IF NOT EXISTS idx_subsections_section ON subsections(section_id);
    CREATE INDEX IF NOT EXISTS idx_books_subsection ON books(subsection_id);
    CREATE INDEX IF NOT EXISTS idx_books_code ON books(code);
    CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id);
    CREATE INDEX IF NOT EXISTS idx_book_versions_book ON book_versions(book_id);
    CREATE INDEX IF NOT EXISTS idx_book_versions_code ON book_versions(code);
  `);

  // Migración segura para bases de datos existentes
  const columns = db.prepare("PRAGMA table_info(books)").all().map(c => c.name);
  if (!columns.includes('code')) {
    db.exec("ALTER TABLE books ADD COLUMN code TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.includes('version')) {
    db.exec("ALTER TABLE books ADD COLUMN version TEXT NOT NULL DEFAULT '1.0.0'");
  }
  if (!columns.includes('publication_date')) {
    db.exec("ALTER TABLE books ADD COLUMN publication_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
  }
  if (!columns.includes('checksum')) {
    db.exec("ALTER TABLE books ADD COLUMN checksum TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.includes('state')) {
    db.exec("ALTER TABLE books ADD COLUMN state TEXT NOT NULL DEFAULT 'published'");
  }
  if (!columns.includes('changelog')) {
    db.exec("ALTER TABLE books ADD COLUMN changelog TEXT DEFAULT ''");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_books_code ON books(code)");

  const chapterCols = db.prepare("PRAGMA table_info(chapters)").all().map(c => c.name);
  if (!chapterCols.includes('checksum')) {
    db.exec("ALTER TABLE chapters ADD COLUMN checksum TEXT NOT NULL DEFAULT ''");
  }

  const verCols = db.prepare("PRAGMA table_info(book_versions)").all().map(c => c.name);
  if (verCols.length > 0) {
    if (!verCols.includes('state')) {
      db.exec("ALTER TABLE book_versions ADD COLUMN state TEXT NOT NULL DEFAULT 'published'");
    }
    if (!verCols.includes('changelog')) {
      db.exec("ALTER TABLE book_versions ADD COLUMN changelog TEXT DEFAULT ''");
    }
  }
}

initDb();
prepareStatements();

function closeDatabase() {
  if (db && db.open) {
    try {
      db.close();
    } catch (_) {}
  }
}

function reopenDatabase(customPath = null) {
  closeDatabase();
  const targetPath = customPath || DB_PATH;
  db = new Database(targetPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initDb();
  prepareStatements();
  module.exports.db = db;
  return db;
}

async function backupDatabase(destPath) {
  return db.backup(destPath);
}

function remapStoragePaths(baseLibraryPath) {
  const books = db.prepare(`
    SELECT b.id, b.storage_path, s.slug as section_slug, sub.slug as subsection_slug
    FROM books b
    JOIN subsections sub ON b.subsection_id = sub.id
    JOIN sections s ON sub.section_id = s.id
  `).all();

  const updateStmt = db.prepare('UPDATE books SET storage_path = ? WHERE id = ?');
  const tx = db.transaction(() => {
    for (const b of books) {
      const folderName = path.basename(b.storage_path);
      let newPath = path.join(baseLibraryPath, b.section_slug, b.subsection_slug, folderName);
      if (!fs.existsSync(newPath)) {
        const flatPath = path.join(baseLibraryPath, folderName);
        if (fs.existsSync(flatPath)) {
          newPath = flatPath;
        }
      }
      updateStmt.run(newPath, b.id);
    }
  });
  tx();
}

function getDatabaseStats() {
  const sectionsCount = db.prepare('SELECT COUNT(*) as count FROM sections').get().count;
  const subsectionsCount = db.prepare('SELECT COUNT(*) as count FROM subsections').get().count;
  const booksCount = db.prepare('SELECT COUNT(*) as count FROM books').get().count;
  const chaptersCount = db.prepare('SELECT COUNT(*) as count FROM chapters').get().count;
  return { sectionsCount, subsectionsCount, booksCount, chaptersCount };
}

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general';
}

function getOrCreateSection(name) {
  const cleanName = (name && name.trim()) || 'General';
  const slug = slugify(cleanName);

  const existing = db.prepare('SELECT * FROM sections WHERE slug = ?').get(slug);
  if (existing) return existing;

  const info = db.prepare('INSERT INTO sections (name, slug) VALUES (?, ?)').run(cleanName, slug);
  return db.prepare('SELECT * FROM sections WHERE id = ?').get(info.lastInsertRowid);
}

function getOrCreateSubsection(sectionId, name) {
  const cleanName = (name && name.trim()) || 'General';
  const slug = slugify(cleanName);

  const existing = db.prepare('SELECT * FROM subsections WHERE section_id = ? AND slug = ?').get(sectionId, slug);
  if (existing) return existing;

  const info = db.prepare('INSERT INTO subsections (section_id, name, slug) VALUES (?, ?, ?)').run(sectionId, cleanName, slug);
  return db.prepare('SELECT * FROM subsections WHERE id = ?').get(info.lastInsertRowid);
}

function findBookByCode(code) {
  if (!code) return null;
  return db.prepare('SELECT * FROM books WHERE code = ?').get(code);
}


function createBookTransaction(bookData, chaptersData) {
  const runTransaction = db.transaction(() => {
    const section = getOrCreateSection(bookData.section);
    const subsection = getOrCreateSubsection(section.id, bookData.subsection);

    const bookSlug = slugify(bookData.title) + '-' + Date.now().toString(36);
    const bookCode = bookData.code || ('BK-' + slugify(bookData.title).toUpperCase());
    const bookVersion = bookData.version || '1.0.0';
    const pubDate = bookData.publication_date || new Date().toISOString().split('T')[0];
    const state = bookData.state || 'published';
    const changelog = bookData.changelog || '';

    const bookResult = insertBookStmt.run({
      subsection_id: subsection.id,
      code: bookCode,
      title: bookData.title,
      slug: bookSlug,
      version: bookVersion,
      publication_date: pubDate,
      author: bookData.author || 'Desconocido',
      description: bookData.description || '',
      cover_image: bookData.cover_image || '',
      storage_path: bookData.storage_path,
      total_chapters: chaptersData.length,
      checksum: bookData.checksum || '',
      state,
      changelog
    });

    const bookId = bookResult.lastInsertRowid;

    for (const ch of chaptersData) {
      insertChapterStmt.run({
        book_id: bookId,
        title: ch.title,
        order_index: ch.order_index,
        file_name: ch.file_name,
        relative_path: ch.relative_path,
        word_count: ch.word_count || 0,
        checksum: ch.checksum || ''
      });
    }

    // Registrar versión inmutable en book_versions
    insertVersionStmt.run({
      book_id: bookId,
      code: bookCode,
      version: bookVersion,
      publication_date: pubDate,
      state,
      changelog,
      checksum: bookData.checksum || '',
      storage_path: bookData.storage_path,
      total_chapters: chaptersData.length,
      chapters_manifest: JSON.stringify(chaptersData.map(c => ({
        title: c.title,
        order_index: c.order_index,
        file_name: c.file_name,
        relative_path: c.relative_path,
        word_count: c.word_count || 0,
        checksum: c.checksum || ''
      })))
    });

    return bookId;
  });

  return runTransaction();
}

function replaceBookTransaction(existingBookId, bookData, chaptersData) {
  const runTransaction = db.transaction(() => {
    const section = getOrCreateSection(bookData.section);
    const subsection = getOrCreateSubsection(section.id, bookData.subsection);

    const bookSlug = slugify(bookData.title) + '-' + Date.now().toString(36);
    const bookCode = bookData.code;
    const bookVersion = bookData.version || '1.0.0';
    const pubDate = bookData.publication_date || new Date().toISOString().split('T')[0];
    const state = bookData.state || 'published';
    const changelog = bookData.changelog || '';

    // Si la versión anterior estaba como published, marcarla como archived en book_versions
    const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(existingBookId);
    if (existing) {
      db.prepare("UPDATE book_versions SET state = 'archived' WHERE book_id = ? AND state = 'published' AND version != ?").run(existingBookId, bookVersion);
    }

    // Actualizar libro existente
    db.prepare(`
      UPDATE books 
      SET subsection_id = @subsection_id,
          code = @code,
          title = @title,
          slug = @slug,
          version = @version,
          publication_date = @publication_date,
          author = @author,
          description = @description,
          cover_image = @cover_image,
          storage_path = @storage_path,
          total_chapters = @total_chapters,
          checksum = @checksum,
          state = @state,
          changelog = @changelog,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
      id: existingBookId,
      subsection_id: subsection.id,
      code: bookCode,
      title: bookData.title,
      slug: bookSlug,
      version: bookVersion,
      publication_date: pubDate,
      author: bookData.author || 'Desconocido',
      description: bookData.description || '',
      cover_image: bookData.cover_image || '',
      storage_path: bookData.storage_path,
      total_chapters: chaptersData.length,
      checksum: bookData.checksum || '',
      state,
      changelog
    });

    // Eliminar capítulos antiguos
    db.prepare('DELETE FROM chapters WHERE book_id = ?').run(existingBookId);

    // Insertar capítulos nuevos
    for (const ch of chaptersData) {
      insertChapterStmt.run({
        book_id: existingBookId,
        title: ch.title,
        order_index: ch.order_index,
        file_name: ch.file_name,
        relative_path: ch.relative_path,
        word_count: ch.word_count || 0,
        checksum: ch.checksum || ''
      });
    }

    // Registrar nueva versión inmutable en book_versions
    insertVersionStmt.run({
      book_id: existingBookId,
      code: bookCode,
      version: bookVersion,
      publication_date: pubDate,
      state,
      changelog,
      checksum: bookData.checksum || '',
      storage_path: bookData.storage_path,
      total_chapters: chaptersData.length,
      chapters_manifest: JSON.stringify(chaptersData.map(c => ({
        title: c.title,
        order_index: c.order_index,
        file_name: c.file_name,
        relative_path: c.relative_path,
        word_count: c.word_count || 0,
        checksum: c.checksum || ''
      })))
    });

    // Limpiar secciones o subsecciones huérfanas
    db.prepare(`
      DELETE FROM subsections 
      WHERE id NOT IN (SELECT DISTINCT subsection_id FROM books)
    `).run();

    db.prepare(`
      DELETE FROM sections 
      WHERE id NOT IN (SELECT DISTINCT section_id FROM subsections)
    `).run();

    return existingBookId;
  });

  return runTransaction();
}

function getLibraryTree() {
  const sections = db.prepare('SELECT * FROM sections ORDER BY name ASC').all();
  const subsections = db.prepare('SELECT * FROM subsections ORDER BY name ASC').all();
  const books = db.prepare(`
    SELECT b.*, s.name as section_name, sub.name as subsection_name 
    FROM books b
    JOIN subsections sub ON b.subsection_id = sub.id
    JOIN sections s ON sub.section_id = s.id
    ORDER BY b.title ASC
  `).all();

  const subMap = new Map();
  for (const sub of subsections) {
    subMap.set(sub.id, { ...sub, books: [] });
  }

  for (const book of books) {
    if (subMap.has(book.subsection_id)) {
      subMap.get(book.subsection_id).books.push(book);
    }
  }

  const result = sections.map(sec => {
    const secSubs = subsections
      .filter(sub => sub.section_id === sec.id)
      .map(sub => subMap.get(sub.id));
    return {
      ...sec,
      subsections: secSubs
    };
  });

  return result;
}

function getBookById(id) {
  const book = db.prepare(`
    SELECT b.*, s.id as section_id, s.name as section_name, sub.name as subsection_name
    FROM books b
    JOIN subsections sub ON b.subsection_id = sub.id
    JOIN sections s ON sub.section_id = s.id
    WHERE b.id = ?
  `).get(id);

  if (!book) return null;

  const chapters = db.prepare(`
    SELECT * FROM chapters 
    WHERE book_id = ? 
    ORDER BY order_index ASC
  `).all(id);

  return { ...book, chapters };
}

function getChapterContent(bookId, chapterId) {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) throw new Error('Libro no encontrado');

  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ? AND book_id = ?').get(chapterId, bookId);
  if (!chapter) throw new Error('Capítulo no encontrado');

  const filePath = path.join(book.storage_path, chapter.relative_path);
  if (!fs.existsSync(filePath)) {
    throw new Error('El archivo del capítulo no existe en disco: ' + chapter.relative_path);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return {
    chapter,
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      code: book.code,
      version: book.version,
      publication_date: book.publication_date
    },
    content
  };
}

function deleteBook(id) {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
  if (!book) return null;

  db.prepare('DELETE FROM books WHERE id = ?').run(id);

  // Limpiar subsecciones y secciones vacías si ya no tienen libros
  db.prepare(`
    DELETE FROM subsections 
    WHERE id NOT IN (SELECT DISTINCT subsection_id FROM books)
  `).run();

  db.prepare(`
    DELETE FROM sections 
    WHERE id NOT IN (SELECT DISTINCT section_id FROM subsections)
  `).run();

  return book;
}

function searchLibrary(query) {
  const term = `%${query.trim()}%`;
  const books = db.prepare(`
    SELECT DISTINCT b.*, s.name as section_name, sub.name as subsection_name
    FROM books b
    JOIN subsections sub ON b.subsection_id = sub.id
    JOIN sections s ON sub.section_id = s.id
    LEFT JOIN chapters c ON b.id = c.book_id
    WHERE b.title LIKE ? 
       OR b.code LIKE ?
       OR b.author LIKE ? 
       OR b.description LIKE ? 
       OR c.title LIKE ?
    ORDER BY b.title ASC
  `).all(term, term, term, term, term);

  return books;
}

function verifyBookIntegrity(bookId) {
  const book = getBookById(bookId);
  if (!book) return null;

  let anyMissing = false;
  let anyModified = false;
  const chaptersReport = [];
  const hashesForComposite = [];

  for (const ch of book.chapters) {
    const filePath = path.join(book.storage_path, ch.relative_path);
    if (!fs.existsSync(filePath)) {
      anyMissing = true;
      chaptersReport.push({
        id: ch.id,
        title: ch.title,
        order_index: ch.order_index,
        chapter_number: ch.order_index,
        file_name: ch.file_name,
        relative_path: ch.relative_path,
        expectedChecksum: ch.checksum || '',
        actualChecksum: null,
        status: 'missing'
      });
      continue;
    }

    const contentBuf = fs.readFileSync(filePath);
    const actualChecksum = crypto.createHash('sha256').update(contentBuf).digest('hex');
    hashesForComposite.push(actualChecksum);

    let status = 'verified';
    if (ch.checksum && ch.checksum !== actualChecksum) {
      status = 'modified';
      anyModified = true;
    }

    chaptersReport.push({
      id: ch.id,
      title: ch.title,
      order_index: ch.order_index,
      chapter_number: ch.order_index,
      file_name: ch.file_name,
      relative_path: ch.relative_path,
      expectedChecksum: ch.checksum || '',
      actualChecksum,
      status
    });
  }

  // Hash canónico del libro a partir de sus capítulos actuales
  const currentComposite = crypto.createHash('sha256')
    .update(`${book.code}:${book.version}:${hashesForComposite.join(':')}`)
    .digest('hex');

  let bookStatus = 'verified';
  if (anyMissing) {
    bookStatus = 'missing_files';
  } else if (anyModified || (book.checksum && book.checksum !== currentComposite)) {
    bookStatus = 'modified';
  }

  return {
    bookId: book.id,
    id: book.id,
    title: book.title,
    code: book.code,
    version: book.version,
    status: bookStatus,
    bookChecksum: book.checksum || currentComposite,
    composite_checksum: currentComposite,
    stored_checksum: book.checksum || currentComposite,
    total_chapters: chaptersReport.length,
    chapters: chaptersReport.map(c => ({
      ...c,
      stored_checksum: c.expectedChecksum,
      calculated_checksum: c.actualChecksum
    })),
    verifiedAt: new Date().toISOString()
  };
}

function verifyLibraryIntegrity() {
  const books = db.prepare('SELECT id FROM books ORDER BY id ASC').all();
  const reports = books.map(b => verifyBookIntegrity(b.id)).filter(Boolean);
  const total = reports.length;
  const verified = reports.filter(r => r.status === 'verified').length;
  const modified = reports.filter(r => r.status === 'modified').length;
  const missing = reports.filter(r => r.status === 'missing_files').length;

  return {
    totalBooks: total,
    total_books: total,
    verifiedBooks: verified,
    verified_books: verified,
    modifiedBooks: modified,
    modified_books: modified,
    missingFilesBooks: missing,
    missing_files_books: missing,
    allHealthy: total > 0 && verified === total,
    all_healthy: total > 0 && verified === total,
    books: reports,
    verifiedAt: new Date().toISOString()
  };
}

/**
 * Obtiene el historial completo de versiones de un libro (por ID o código), ordenado por SemVer descendente.
 * @param {number|string} bookIdOrCode
 * @returns {Array<object>}
 */
function getBookVersions(bookIdOrCode) {
  let rows;
  if (typeof bookIdOrCode === 'number' || /^\d+$/.test(String(bookIdOrCode))) {
    const book = db.prepare('SELECT code FROM books WHERE id = ?').get(bookIdOrCode);
    const code = book ? book.code : '';
    rows = db.prepare(`
      SELECT bv.*, b.title as current_book_title
      FROM book_versions bv
      LEFT JOIN books b ON bv.book_id = b.id
      WHERE bv.book_id = ? OR (bv.code != '' AND bv.code = ?)
      ORDER BY bv.id DESC
    `).all(bookIdOrCode, code);
  } else {
    rows = db.prepare(`
      SELECT bv.*, b.title as current_book_title
      FROM book_versions bv
      LEFT JOIN books b ON bv.book_id = b.id
      WHERE bv.code = ?
      ORDER BY bv.id DESC
    `).all(String(bookIdOrCode));
  }

  // Parsear chapters_manifest de cada versión y ordenar por SemVer
  const parsed = rows.map(r => {
    let chapters = [];
    if (r.chapters_manifest) {
      try { chapters = JSON.parse(r.chapters_manifest); } catch (_) {}
    }
    return { ...r, chapters };
  });

  parsed.sort((a, b) => compareSemVer(b.version, a.version));
  return parsed;
}

/**
 * Obtiene una versión específica por su ID en book_versions.
 * @param {number} versionId
 * @returns {object|null}
 */
function getVersionById(versionId) {
  const row = db.prepare(`
    SELECT bv.*, b.title as current_book_title
    FROM book_versions bv
    LEFT JOIN books b ON bv.book_id = b.id
    WHERE bv.id = ?
  `).get(versionId);

  if (!row) return null;

  let chapters = [];
  if (row.chapters_manifest) {
    try { chapters = JSON.parse(row.chapters_manifest); } catch (_) {}
  }
  return { ...row, chapters };
}

/**
 * Busca una versión por su código de libro y cadena de versión SemVer.
 * @param {string} code
 * @param {string} version
 * @returns {object|null}
 */
function findVersionByCodeAndVersion(code, version) {
  const row = db.prepare(`
    SELECT bv.*, b.title as current_book_title
    FROM book_versions bv
    LEFT JOIN books b ON bv.book_id = b.id
    WHERE bv.code = ? AND bv.version = ?
  `).get(code, version);

  if (!row) return null;

  let chapters = [];
  if (row.chapters_manifest) {
    try { chapters = JSON.parse(row.chapters_manifest); } catch (_) {}
  }
  return { ...row, chapters };
}

/**
 * Actualiza el estado de ciclo de vida de un libro ('draft' | 'published' | 'archived').
 * @param {number} bookId
 * @param {'draft'|'published'|'archived'} state
 */
function updateBookState(bookId, state) {
  const allowed = ['draft', 'published', 'archived'];
  if (!allowed.includes(state)) {
    throw new Error(`Estado no válido: "${state}". Permitidos: ${allowed.join(', ')}`);
  }
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) throw new Error('Libro no encontrado');

  db.prepare('UPDATE books SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(state, bookId);
  db.prepare('UPDATE book_versions SET state = ? WHERE book_id = ? AND version = ?').run(state, bookId, book.version);

  return { success: true, bookId, state };
}

/**
 * Actualiza el estado de ciclo de vida de una versión específica.
 * @param {number} versionId
 * @param {'draft'|'published'|'archived'} state
 */
function updateVersionState(versionId, state) {
  const allowed = ['draft', 'published', 'archived'];
  if (!allowed.includes(state)) {
    throw new Error(`Estado no válido: "${state}". Permitidos: ${allowed.join(', ')}`);
  }
  const ver = db.prepare('SELECT * FROM book_versions WHERE id = ?').get(versionId);
  if (!ver) throw new Error('Versión no encontrada');

  db.prepare('UPDATE book_versions SET state = ? WHERE id = ?').run(state, versionId);

  // Si esta versión coincide con la versión activa del libro principal, sincronizar
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(ver.book_id);
  if (book && book.version === ver.version) {
    db.prepare('UPDATE books SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(state, book.id);
  }

  return { success: true, versionId, state };
}

/**
 * Activa una versión previa como la versión principal del libro.
 * @param {number} bookId
 * @param {number} versionId
 */
function activateBookVersion(bookId, versionId) {
  const version = getVersionById(versionId);
  if (!version) throw new Error('Versión no encontrada');
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) throw new Error('Libro no encontrado');

  const tx = db.transaction(() => {
    // 1. Archivar versión actual si estaba publicada
    db.prepare("UPDATE book_versions SET state = 'archived' WHERE book_id = ? AND version = ? AND state = 'published'").run(bookId, book.version);

    // 2. Marcar versión seleccionada como publicada
    db.prepare("UPDATE book_versions SET state = 'published' WHERE id = ?").run(versionId);

    // 3. Actualizar libro principal
    db.prepare(`
      UPDATE books
      SET version = @version,
          publication_date = @publication_date,
          state = 'published',
          changelog = @changelog,
          checksum = @checksum,
          storage_path = @storage_path,
          total_chapters = @total_chapters,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
      id: bookId,
      version: version.version,
      publication_date: version.publication_date,
      changelog: version.changelog || '',
      checksum: version.checksum,
      storage_path: version.storage_path,
      total_chapters: version.total_chapters
    });

    // 4. Reemplazar capítulos activos en la tabla chapters
    db.prepare('DELETE FROM chapters WHERE book_id = ?').run(bookId);

    const chapters = version.chapters || [];
    for (const ch of chapters) {
      insertChapterStmt.run({
        book_id: bookId,
        title: ch.title,
        order_index: ch.order_index,
        file_name: ch.file_name,
        relative_path: ch.relative_path,
        word_count: ch.word_count || 0,
        checksum: ch.checksum || ''
      });
    }
  });

  tx();
  const updatedBook = getBookById(bookId);
  return {
    success: true,
    activated_version: version.version,
    ...updatedBook
  };
}

module.exports = {
  db,
  DB_PATH,
  slugify,
  getOrCreateSection,
  getOrCreateSubsection,
  findBookByCode,
  createBookTransaction,
  replaceBookTransaction,
  getLibraryTree,
  getBookById,
  getChapterContent,
  deleteBook,
  searchLibrary,
  backupDatabase,
  reopenDatabase,
  closeDatabase,
  remapStoragePaths,
  getDatabaseStats,
  verifyBookIntegrity,
  verifyLibraryIntegrity,
  getBookVersions,
  getVersionById,
  findVersionByCodeAndVersion,
  updateBookState,
  updateVersionState,
  activateBookVersion
};


