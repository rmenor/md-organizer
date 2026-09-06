const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || (process.env.VERCEL ? path.join('/tmp', 'library.db') : path.join(__dirname, '..', 'library.db'));

// Asegurar directorio para la base de datos si es necesario
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Configuración de rendimiento y restricciones
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_subsections_section ON subsections(section_id);
    CREATE INDEX IF NOT EXISTS idx_books_subsection ON books(subsection_id);
    CREATE INDEX IF NOT EXISTS idx_books_code ON books(code);
    CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id);
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
  db.exec("CREATE INDEX IF NOT EXISTS idx_books_code ON books(code)");
}

initDb();

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

const insertBookStmt = db.prepare(`
  INSERT INTO books (subsection_id, code, title, slug, version, publication_date, author, description, cover_image, storage_path, total_chapters)
  VALUES (@subsection_id, @code, @title, @slug, @version, @publication_date, @author, @description, @cover_image, @storage_path, @total_chapters)
`);

const insertChapterStmt = db.prepare(`
  INSERT INTO chapters (book_id, title, order_index, file_name, relative_path, word_count)
  VALUES (@book_id, @title, @order_index, @file_name, @relative_path, @word_count)
`);

function createBookTransaction(bookData, chaptersData) {
  const runTransaction = db.transaction(() => {
    const section = getOrCreateSection(bookData.section);
    const subsection = getOrCreateSubsection(section.id, bookData.subsection);

    const bookSlug = slugify(bookData.title) + '-' + Date.now().toString(36);

    const bookResult = insertBookStmt.run({
      subsection_id: subsection.id,
      code: bookData.code || ('BK-' + slugify(bookData.title).toUpperCase()),
      title: bookData.title,
      slug: bookSlug,
      version: bookData.version || '1.0.0',
      publication_date: bookData.publication_date || new Date().toISOString().split('T')[0],
      author: bookData.author || 'Desconocido',
      description: bookData.description || '',
      cover_image: bookData.cover_image || '',
      storage_path: bookData.storage_path,
      total_chapters: chaptersData.length
    });

    const bookId = bookResult.lastInsertRowid;

    for (const ch of chaptersData) {
      insertChapterStmt.run({
        book_id: bookId,
        title: ch.title,
        order_index: ch.order_index,
        file_name: ch.file_name,
        relative_path: ch.relative_path,
        word_count: ch.word_count || 0
      });
    }

    return bookId;
  });

  return runTransaction();
}

function replaceBookTransaction(existingBookId, bookData, chaptersData) {
  const runTransaction = db.transaction(() => {
    const section = getOrCreateSection(bookData.section);
    const subsection = getOrCreateSubsection(section.id, bookData.subsection);

    const bookSlug = slugify(bookData.title) + '-' + Date.now().toString(36);

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
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
      id: existingBookId,
      subsection_id: subsection.id,
      code: bookData.code,
      title: bookData.title,
      slug: bookSlug,
      version: bookData.version || '1.0.0',
      publication_date: bookData.publication_date || new Date().toISOString().split('T')[0],
      author: bookData.author || 'Desconocido',
      description: bookData.description || '',
      cover_image: bookData.cover_image || '',
      storage_path: bookData.storage_path,
      total_chapters: chaptersData.length
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
        word_count: ch.word_count || 0
      });
    }

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

module.exports = {
  db,
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
  searchLibrary
};
