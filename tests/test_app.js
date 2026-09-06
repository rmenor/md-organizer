const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// Configurar base de datos y carpeta de biblioteca de prueba aislada
const TEST_DB_PATH = path.join(__dirname, 'test_library.db');
const TEST_LIB_PATH = path.join(__dirname, 'test_library');

process.env.DB_PATH = TEST_DB_PATH;
process.env.LIBRARY_PATH = TEST_LIB_PATH;

if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
if (fs.existsSync(TEST_LIB_PATH)) fs.rmSync(TEST_LIB_PATH, { recursive: true, force: true });

const {
  getOrCreateSection,
  getOrCreateSubsection,
  findBookByCode,
  createBookTransaction,
  replaceBookTransaction,
  getLibraryTree,
  getBookById,
  getChapterContent,
  searchLibrary,
  deleteBook
} = require('../src/db');
const { processZipFile, safeResolvePath, securityScanZip } = require('../src/processor');
const AdmZip = require('adm-zip');

test('Capa de Base de Datos (SQLite3)', async (t) => {
  await t.test('Crea y recupera secciones y subsecciones', () => {
    const sec = getOrCreateSection('Tecnología');
    assert.ok(sec.id > 0);
    assert.equal(sec.name, 'Tecnología');
    assert.equal(sec.slug, 'tecnologia');

    const sub = getOrCreateSubsection(sec.id, 'Frontend');
    assert.ok(sub.id > 0);
    assert.equal(sub.section_id, sec.id);
    assert.equal(sub.slug, 'frontend');

    const sec2 = getOrCreateSection('Tecnología');
    assert.equal(sec.id, sec2.id);
  });

  await t.test('Transacción de libro con código, fecha y versión', () => {
    const fakeBookDir = path.join(TEST_LIB_PATH, 'fake-book');
    fs.mkdirSync(fakeBookDir, { recursive: true });
    const cap1Path = path.join(fakeBookDir, '01_intro.md');
    fs.writeFileSync(cap1Path, '# Hola Mundo\nContenido v1.', 'utf8');

    const bookId = createBookTransaction(
      {
        code: 'TEST-001',
        title: 'Libro de Prueba',
        version: '1.0.0',
        publication_date: '2024-01-01',
        author: 'Tester',
        description: 'Descripción breve',
        section: 'Ciencia',
        subsection: 'Física',
        storage_path: fakeBookDir
      },
      [
        {
          title: 'Introducción',
          order_index: 1,
          file_name: '01_intro.md',
          relative_path: '01_intro.md',
          word_count: 5
        }
      ]
    );

    assert.ok(bookId > 0);

    const found = findBookByCode('TEST-001');
    assert.ok(found);
    assert.equal(found.code, 'TEST-001');
    assert.equal(found.version, '1.0.0');
    assert.equal(found.publication_date, '2024-01-01');

    const book = getBookById(bookId);
    assert.equal(book.title, 'Libro de Prueba');
    assert.equal(book.chapters.length, 1);
  });

  await t.test('Sustitución de libro existente (replaceBookTransaction)', () => {
    const existing = findBookByCode('TEST-001');
    assert.ok(existing);

    const updatedDir = path.join(TEST_LIB_PATH, 'fake-book-v2');
    fs.mkdirSync(updatedDir, { recursive: true });
    const cap1Path = path.join(updatedDir, '01_intro.md');
    fs.writeFileSync(cap1Path, '# Hola Mundo v2\nContenido actualizado.', 'utf8');

    const replacedId = replaceBookTransaction(
      existing.id,
      {
        code: 'TEST-001',
        title: 'Libro de Prueba (Segunda Edición)',
        version: '2.0.0',
        publication_date: '2025-01-01',
        author: 'Tester',
        description: 'Nueva descripción',
        section: 'Ciencia',
        subsection: 'Física',
        storage_path: updatedDir
      },
      [
        {
          title: 'Introducción Renovada',
          order_index: 1,
          file_name: '01_intro.md',
          relative_path: '01_intro.md',
          word_count: 8
        }
      ]
    );

    assert.equal(replacedId, existing.id);

    const bookV2 = getBookById(existing.id);
    assert.equal(bookV2.title, 'Libro de Prueba (Segunda Edición)');
    assert.equal(bookV2.version, '2.0.0');
    assert.equal(bookV2.publication_date, '2025-01-01');
    assert.equal(bookV2.chapters[0].title, 'Introducción Renovada');
  });
});

test('Procesador de Archivos ZIP y Control de Versiones', async (t) => {
  const sampleV1 = path.join(__dirname, '..', 'examples', '1_libro_codigo_limpio_v1.zip');
  const sampleV0Antiguo = path.join(__dirname, '..', 'examples', '2_libro_antiguo_v0.9_rechazado.zip');
  const sampleV2Nuevo = path.join(__dirname, '..', 'examples', '3_libro_nuevo_v2_actualizado.zip');
  const sampleAuto = path.join(__dirname, '..', 'examples', '4_sqlite_guia_auto.zip');

  await t.test('1. Importa libro base v1.0.0 (fecha 2024-01-15)', async () => {
    const book = await processZipFile(sampleV1, '1_libro_codigo_limpio_v1.zip');

    assert.ok(book.id > 0);
    assert.equal(book.code, 'BK-CLEAN-CODE');
    assert.equal(book.version, '1.0.0');
    assert.equal(book.publication_date, '2024-01-15');
    assert.equal(book.replaced, false);

    assert.ok(fs.existsSync(book.storage_path));
    assert.ok(fs.existsSync(path.join(book.storage_path, 'metadata.json')));
  });

  await t.test('2. Rechaza importación si la fecha es inferior (fecha 2023-10-01 < 2024-01-15)', async () => {
    await assert.rejects(
      async () => {
        await processZipFile(sampleV0Antiguo, '2_libro_antiguo_v0.9_rechazado.zip');
      },
      (err) => {
        assert.equal(err.isVersionConflict, true);
        assert.ok(err.message.includes('Ya está instalada una versión superior o igual'));
        assert.ok(err.message.includes('BK-CLEAN-CODE'));
        return true;
      }
    );
  });

  await t.test('3. Sustituye libro si la fecha es superior (fecha 2025-06-01 > 2024-01-15)', async () => {
    const bookReplaced = await processZipFile(sampleV2Nuevo, '3_libro_nuevo_v2_actualizado.zip');

    assert.ok(bookReplaced.id > 0);
    assert.equal(bookReplaced.replaced, true);
    assert.equal(bookReplaced.code, 'BK-CLEAN-CODE');
    assert.equal(bookReplaced.previousVersion, '1.0.0');
    assert.equal(bookReplaced.version, '2.0.0');
    assert.equal(bookReplaced.publication_date, '2025-06-01');

    // Verificar en base de datos
    const dbBook = getBookById(bookReplaced.id);
    assert.equal(dbBook.version, '2.0.0');
    assert.equal(dbBook.publication_date, '2025-06-01');

    // Comprobar que en disco contiene el capítulo con nota de v2.0.0
    const content = getChapterContent(bookReplaced.id, dbBook.chapters[0].id);
    assert.ok(content.content.includes('Versión 2.0.0'));
  });

  await t.test('4. Infiere código, fecha y versión si no hay metadata.json', async () => {
    const autoBook = await processZipFile(sampleAuto, '4_sqlite_guia_auto.zip');

    assert.ok(autoBook.id > 0);
    assert.equal(autoBook.code, 'BK-SQLITE-EMB');
    assert.equal(autoBook.version, '1.2.0');
    assert.equal(autoBook.publication_date, '2024-08-20');
  });

  await t.test('5. Ingesta paquete MDZ con Book Profile (manifest.json + metadata/book.json + chapters/ + assets/)', async () => {
    const testMdzPath = path.join(__dirname, 'test_sample.mdz');
    const zip = new AdmZip();

    // 1. manifest.json
    const manifest = {
      format: 'mdz',
      version: '1.0',
      profile: 'book',
      metadata: 'metadata/book.json'
    };
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

    // 2. metadata/book.json
    const bookMeta = {
      code: 'BK-MDZ-SPEC',
      title: 'Especificación MDZ y Perfil de Libros',
      author: 'Equipo Markdown',
      version: '1.0.0',
      publication_date: '2026-09-06',
      description: 'Guía del formato portable MDZ para empaquetado de libros.',
      section: 'Arquitectura',
      subsection: 'Formatos',
      cover: 'cover.webp',
      chapters: [
        { title: '1. Introducción a MDZ', file: 'chapters/01_intro.md' },
        { title: '2. Estructura del Manifiesto', file: 'chapters/02_manifest.md' }
      ]
    };
    zip.addFile('metadata/book.json', Buffer.from(JSON.stringify(bookMeta, null, 2), 'utf8'));

    // 3. chapters
    zip.addFile('chapters/01_intro.md', Buffer.from('# Introducción a MDZ\nContenido del capítulo 1.', 'utf8'));
    zip.addFile('chapters/02_manifest.md', Buffer.from('# Estructura del Manifiesto\nContenido del capítulo 2.', 'utf8'));

    // 4. assets
    zip.addFile('assets/cover.webp', Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'ascii'));

    zip.writeZip(testMdzPath);

    const mdzBook = await processZipFile(testMdzPath, 'test_sample.mdz');

    assert.ok(mdzBook.id > 0);
    assert.equal(mdzBook.code, 'BK-MDZ-SPEC');
    assert.equal(mdzBook.title, 'Especificación MDZ y Perfil de Libros');
    assert.equal(mdzBook.section, 'Arquitectura');
    assert.equal(mdzBook.subsection, 'Formatos');
    assert.equal(mdzBook.chapters.length, 2);
    assert.equal(mdzBook.chapters[0].title, '1. Introducción a MDZ');
    assert.equal(mdzBook.chapters[1].title, '2. Estructura del Manifiesto');
    assert.equal(mdzBook.cover_image, path.join('assets', 'cover.webp'));

    const dbRecord = getBookById(mdzBook.id);
    assert.ok(dbRecord);
    assert.equal(dbRecord.code, 'BK-MDZ-SPEC');
    assert.equal(dbRecord.chapters.length, 2);

    // Limpiar archivo .mdz de prueba
    if (fs.existsSync(testMdzPath)) fs.unlinkSync(testMdzPath);
  });
});

test('Hardening de seguridad del importador ZIP/MDZ', async (t) => {
  const tempFiles = [];
  const makeZip = (name, entryName, content = '# capítulo') => {
    const filePath = path.join(__dirname, name);
    const zip = new AdmZip();
    zip.addFile(entryName, Buffer.from(content, 'utf8'));
    zip.writeZip(filePath);
    tempFiles.push(filePath);
    return filePath;
  };
  const rejectsSecurity = async (filePath) => assert.rejects(
    () => processZipFile(filePath, path.basename(filePath)),
    err => err && err.isSecurityError === true
  );

  await t.test('bloquea traversal Unix, Windows, rutas absolutas y nombres reservados', async () => {
    assert.throws(() => safeResolvePath('../outside.md', TEST_LIB_PATH), /traversal/i);
    assert.throws(() => safeResolvePath('..\\outside.md', TEST_LIB_PATH), /traversal/i);
    assert.throws(() => safeResolvePath('/tmp/outside.md', TEST_LIB_PATH), /Absolute path/i);
    assert.throws(() => safeResolvePath('C:\\temp\\outside.md', TEST_LIB_PATH), /Absolute path/i);
    assert.throws(() => safeResolvePath('CON.txt', TEST_LIB_PATH), /Reserved filename/i);
    assert.throws(() => safeResolvePath('safe\0.md', TEST_LIB_PATH), /Null byte/i);
  });

  await t.test('rechaza extensiones ejecutables, SVG y raster con MIME falsificado', async () => {
    await rejectsSecurity(makeZip('blocked-test.zip', 'payload.js'));
    await rejectsSecurity(makeZip('svg-test.zip', 'image.svg', '<svg><script>alert(1)</script></svg>'));
    await rejectsSecurity(makeZip('spoof-test.zip', 'image.png', 'not a PNG'));
  });

  await t.test('aplica ratio, tamaño inválido, symlink y límites sin descomprimir', () => {
    const scanPath = path.join(__dirname, 'scan-limit.zip');
    fs.writeFileSync(scanPath, Buffer.from('PK\x03\x04'));
    tempFiles.push(scanPath);
    const entry = (header, extra = {}) => ({
      entryName: 'chapter.md', isDirectory: false, header, ...extra,
      getData() { throw new Error('scanner must not read entry data'); }
    });
    assert.throws(() => securityScanZip(scanPath, null, [entry({ compressedSize: 1, size: 51 * 1024 * 1024, attr: 0 })]), /demasiado grande/i);
    assert.throws(() => securityScanZip(scanPath, null, [entry({ compressedSize: 1, size: 100, attr: 0 })]), /ratio/i);
    assert.throws(() => securityScanZip(scanPath, null, [entry({ compressedSize: 1, size: 1, attr: 0xA0000000 })]), /Symlink/i);
    assert.throws(() => securityScanZip(scanPath, null, [entry({ compressedSize: undefined, size: 1, attr: 0 })]), /Cabecera ZIP inválida/i);
  });

  await t.test('rechaza un archivo que solo finge ser ZIP por extensión', async () => {
    const fakePath = path.join(__dirname, 'fake-upload.zip');
    fs.writeFileSync(fakePath, 'contenido no comprimido');
    tempFiles.push(fakePath);
    await rejectsSecurity(fakePath);
  });

  await t.test('mantiene el renderizado importado fuera de sinks HTML inseguros', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    const readerSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'reader.js'), 'utf8');
    assert.doesNotMatch(appSource, /innerHTML\s*=\s*marked\.parse/);
    assert.doesNotMatch(readerSource, /innerHTML\s*=\s*marked\.parse/);
    assert.match(appSource, /safeMarkdownFragment/);
    assert.match(readerSource, /safeMarkdownFragment/);
    assert.match(readerSource, /chapter-item-title.*textContent|textContent.*chapter-item-title/s);
    assert.match(appSource, /book-card-info[\s\S]*book-title-label/);
    assert.match(appSource, /book-title-label[^`]*escapeHtml\(book\.title\)/);
  });

  t.after(() => tempFiles.forEach(filePath => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }));
});

test.after(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  if (fs.existsSync(TEST_LIB_PATH)) fs.rmSync(TEST_LIB_PATH, { recursive: true, force: true });
});
