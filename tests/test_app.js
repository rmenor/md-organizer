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
  deleteBook,
  verifyBookIntegrity,
  verifyLibraryIntegrity,
  getBookVersions,
  getVersionById,
  updateBookState,
  updateVersionState,
  activateBookVersion
} = require('../src/db');
const { processZipFile, safeResolvePath, securityScanZip } = require('../src/processor');
const {
  createBackupArchive,
  inspectBackupArchive,
  restoreBackupArchive,
  BACKUP_FORMAT
} = require('../src/backup');
const {
  normalizeSemVer,
  isValidSemVer,
  parseSemVer,
  compareSemVer,
  diffSemVer
} = require('../src/semver');
const {
  computeLineDiff,
  readVersionAssets,
  compareBookVersions
} = require('../src/differ');
const AdmZip = require('adm-zip');

test('Las portadas usan una proporción cuadrada', () => {
  const styles = fs.readFileSync(path.join(__dirname, '..', 'public/css/styles.css'), 'utf8');
  const coverWrap = styles.match(/^\s*\.book-cover-wrap\s*\{[^}]*\}/gm) || [];

  assert.equal(coverWrap.length, 2);
  assert.ok(coverWrap.every((rule) => /aspect-ratio:\s*1\s*\/\s*1/.test(rule)));
  assert.doesNotMatch(coverWrap.join('\n'), /aspect-ratio:\s*2\s*\/\s*3/);
});

test('La cabecera standalone no superpone el safe area superior', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'public/css/styles.css'), 'utf8');

  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /apple-mobile-web-app-status-bar-style" content="black-translucent"/);
  assert.doesNotMatch(html, /apple-mobile-web-app-status-bar-style" content="default"/);
  const appTopbar = styles.match(/\.app-topbar\s*\{[^}]*\}/)?.[0] || '';
  const readerView = styles.match(/\.reader-view\s*\{[^}]*\}/)?.[0] || '';
  const readerTopbar = styles.match(/\.reader-topbar\s*\{[^}]*\}/)?.[0] || '';

  assert.match(appTopbar, /height:\s*var\(--topbar-total-height\)/);
  assert.match(appTopbar, /top:\s*0/);
  assert.match(appTopbar, /padding:\s*var\(--safe-area-inset-top\)/);
  assert.doesNotMatch(appTopbar, /margin-top:/);
  assert.match(readerView, /top:\s*0/);
  assert.match(readerTopbar, /height:\s*var\(--topbar-total-height\)/);
  assert.match(readerTopbar, /padding:\s*var\(--safe-area-inset-top\)/);
  assert.match(styles, /--safe-area-inset-top:\s*constant\(safe-area-inset-top\);/);
});

test('La pestaña Documentación Completa carga la wiki aunque el panel tenga placeholder', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

  assert.match(html, /data-wiki-tab="full"[^>]*>Documentación Completa/);
  assert.match(appSource, /if \(target === 'full'\)\s*\{\s*loadWikiDoc\(\);\s*\}/);
  assert.match(appSource, /if \(wikiDocLoaded && !force\) return;/);
  assert.match(appSource, /wikiDocLoaded = true;/);
});

test('La pestaña Cómo crear libros ofrece herramientas seguras y su flujo de preparación', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
  const cover = fs.readFileSync(path.join(__dirname, '..', 'public/assets/portada-libro-ejemplo.svg'), 'utf8');
  const cleanCodeCover = fs.readFileSync(path.join(__dirname, '..', 'public/assets/portada-codigo-limpio.svg'), 'utf8');
  const tabs = html.match(/<button class="wiki-tab-chip"[^>]*>.*?<\/button>/g) || [];
  const fullIndex = tabs.findIndex((tab) => tab.includes('data-wiki-tab="full"'));
  const createIndex = tabs.findIndex((tab) => tab.includes('data-wiki-tab="create"'));
  const versionIndex = tabs.findIndex((tab) => tab.includes('data-wiki-tab="version"'));

  assert.ok(fullIndex >= 0 && fullIndex < createIndex && createIndex < versionIndex);
  assert.match(html, /<div class="wiki-pane hidden" id="pane-create">[\s\S]*Escribe y previsualiza en Markdown[\s\S]*<\/div>/);
  assert.match(html, /https:\/\/stackedit\.io\/[^>]*target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /https:\/\/dillinger\.io\/[^>]*target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /https:\/\/obsidian\.md\/[^>]*target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /https:\/\/typora\.io\/[^>]*target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /escribir en Markdown[\s\S]*organizar capítulos, portada y <code>metadata\.json<\/code>[\s\S]*previsualizar\/exportar[\s\S]*comprimir/);
  assert.match(html, /src="\/assets\/portada-libro-ejemplo\.svg" alt="Portada de muestra/);
  assert.match(html, /Una portada visual de ejemplo/);
  assert.match(cover, /<svg[^>]*viewBox="0 0 720 720"/);
  assert.match(cover, /<title id="titulo">Portada de muestra/);
  assert.doesNotMatch(cover, /(?:href|xlink:href)=["']https?:\/\//);
  assert.match(html, /El Arte del Código Limpio[\s\S]*portada-codigo-limpio\.svg[\s\S]*Nombres con Significado[\s\S]*Funciones Pequeñas y Enfocadas/);
  assert.match(html, /portada-codigo-limpio\.svg" alt="[^"]+" title="[^"]+"/);
  assert.match(cleanCodeCover, /<title id="titulo">Portada de El Arte del Código Limpio<\/title>/);
  assert.match(cleanCodeCover, /ADA LOVELACE &amp; MARTIN FOWLER/);
  assert.match(cleanCodeCover, /NOMBRES CON SIGNIFICADO/);
  assert.match(cleanCodeCover, /<desc id="descripcion">[\s\S]+<\/desc>/);
  assert.doesNotMatch(cleanCodeCover, /(?:href|xlink:href)=["']https?:\/\//);
});

test('El libro instalado El Arte del Código Limpio tiene una portada PNG válida y coherente', () => {
  const bookDir = path.join(__dirname, '..', 'library/ingenieria-de-software/buenas-practicas/el-arte-del-codigo-limpio-mtp1dgtg');
  const metadata = JSON.parse(fs.readFileSync(path.join(bookDir, 'metadata.json'), 'utf8'));
  const coverPath = path.join(bookDir, metadata.cover);
  const png = fs.readFileSync(coverPath);

  assert.equal(metadata.title, 'El Arte del Código Limpio');
  assert.equal(metadata.author, 'Ada Lovelace & Martin Fowler');
  assert.ok(fs.existsSync(coverPath));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), png.readUInt32BE(20), 'La portada debe ser cuadrada');
  assert.ok(png.readUInt32BE(16) > 1, 'La portada no puede ser un placeholder 1x1');
  assert.match(fs.readFileSync(path.join(bookDir, '01_01_nombres_con_significado.md'), 'utf8'), /Nombres con Significado/);
  assert.match(fs.readFileSync(path.join(bookDir, '02_02_funciones_pequenas.md'), 'utf8'), /Funciones Pequeñas/);
});

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

test('Sistema de Copias de Seguridad y Restauración (Backup & Restore)', async (t) => {
  const tempBackupFiles = [];

  await t.test('1. Exporta copia de seguridad completa (.zip) con manifest, database.sqlite y library/', async () => {
    const backupFile = path.join(__dirname, 'test_export_backup.zip');
    tempBackupFiles.push(backupFile);

    const result = await createBackupArchive(backupFile);
    assert.ok(fs.existsSync(backupFile));
    assert.equal(result.manifest.format, BACKUP_FORMAT);
    assert.ok(result.manifest.stats.booksCount >= 1);
    assert.ok(result.manifest.database_checksum.startsWith('sha256:'));

    // Verificar contenido del ZIP
    const zip = new AdmZip(backupFile);
    const entryNames = zip.getEntries().map(e => e.entryName);
    assert.ok(entryNames.includes('backup-manifest.json'));
    assert.ok(entryNames.includes('database.sqlite'));
  });

  await t.test('2. Inspecciona copia de seguridad (pre-flight) sin modificar la biblioteca', async () => {
    const backupFile = path.join(__dirname, 'test_inspect_backup.zip');
    tempBackupFiles.push(backupFile);
    await createBackupArchive(backupFile);

    const inspection = inspectBackupArchive(backupFile);
    assert.equal(inspection.valid, true);
    assert.equal(inspection.manifest.format, BACKUP_FORMAT);
    assert.ok(inspection.stats.booksCount >= 1);
    assert.ok(inspection.created_at);
  });

  await t.test('3. Restaura una copia de seguridad recuperando libros, capítulos y ajustando storage_path', async () => {
    const backupFile = path.join(__dirname, 'test_restore_backup.zip');
    tempBackupFiles.push(backupFile);
    await createBackupArchive(backupFile);

    // Guardar estado inicial
    const initialTree = getLibraryTree();
    assert.ok(initialTree.length > 0);

    const firstBook = initialTree[0].subsections[0].books[0];
    const originalCode = firstBook.code;

    // Eliminar un libro
    deleteBook(firstBook.id);
    assert.ok(!findBookByCode(originalCode));

    // Restaurar desde el backup
    const restoreResult = await restoreBackupArchive(backupFile);
    assert.equal(restoreResult.success, true);

    // Verificar que el libro eliminado fue recuperado al 100%
    const restoredBook = findBookByCode(originalCode);
    assert.ok(restoredBook, 'El libro restaurado debe existir en la base de datos');
    assert.equal(restoredBook.title, firstBook.title);
    assert.ok(fs.existsSync(restoredBook.storage_path), 'La carpeta del libro debe existir en disco');
  });

  await t.test('4. Ejecuta rollback automático si el backup está corrupto sin perder datos', async () => {
    const corruptFile = path.join(__dirname, 'test_corrupt_backup.zip');
    tempBackupFiles.push(corruptFile);

    // Crear zip con manifest pero db dañada
    const zip = new AdmZip();
    zip.addFile('backup-manifest.json', Buffer.from(JSON.stringify({ format: BACKUP_FORMAT, version: '1.0' })));
    zip.addFile('database.sqlite', Buffer.from('NOT A VALID SQLITE DATABASE HEADER'));
    zip.writeZip(corruptFile);

    const treeBefore = getLibraryTree();
    await assert.rejects(
      () => restoreBackupArchive(corruptFile),
      /cabecera SQLite válida|corrupto|dañada/i
    );

    // Comprobar que la biblioteca sigue intacta
    const treeAfter = getLibraryTree();
    assert.equal(treeAfter.length, treeBefore.length);
  });

  t.after(() => {
    tempBackupFiles.forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  });
});

test('Verificación de Integridad Criptográfica SHA-256', async (t) => {
  let sampleZipPath;

  t.before(() => {
    // Crear un paquete ZIP de prueba con metadatos y capítulos
    const zip = new AdmZip();
    const manifest = {
      code: 'INTEG-01',
      title: 'Libro de Integridad Criptográfica',
      author: 'Security Team',
      version: '1.0.0',
      publication_date: '2026-09-06',
      section: 'Seguridad',
      subsection: 'Criptografía',
      chapters: [
        { number: 1, title: 'Introducción al Hashing', file: '01_intro.md' },
        { number: 2, title: 'Prueba de Manipulación', file: '02_tamper.md' }
      ]
    };

    zip.addFile('metadata.json', Buffer.from(JSON.stringify(manifest)));
    zip.addFile('01_intro.md', Buffer.from('# Capítulo 1\nContenido original e inalterado.'));
    zip.addFile('02_tamper.md', Buffer.from('# Capítulo 2\nSegundo capítulo para pruebas de integridad.'));

    sampleZipPath = path.join(__dirname, 'test_integrity_pkg.zip');
    zip.writeZip(sampleZipPath);
  });

  await t.test('1. Procesa ZIP calculando hashes SHA-256 en capítulos y hash compuesto', async () => {
    const result = await processZipFile(sampleZipPath);
    assert.ok(result.id > 0);

    const book = getBookById(result.id);
    assert.ok(book.checksum, 'El libro debe tener un hash compuesto almacenado');
    assert.equal(book.checksum.length, 64, 'El hash SHA-256 debe tener 64 caracteres hexadecimales');

    const chapters = book.chapters;
    assert.equal(chapters.length, 2);
    chapters.forEach(c => {
      assert.ok(c.checksum, 'Cada capítulo debe tener un checksum SHA-256');
      assert.equal(c.checksum.length, 64);
    });
  });

  await t.test('2. Verifica integridad exitosamente (status: verified) cuando los archivos están intactos', () => {
    const rawBook = findBookByCode('INTEG-01');
    assert.ok(rawBook);

    const report = verifyBookIntegrity(rawBook.id);
    assert.equal(report.status, 'verified');
    assert.equal(report.total_chapters, 2);
    assert.equal(report.chapters.every(c => c.status === 'verified'), true);
    assert.equal(report.composite_checksum, report.stored_checksum);
  });

  await t.test('3. Detecta alteración (status: modified) cuando un archivo markdown es modificado en disco', () => {
    const rawBook = findBookByCode('INTEG-01');
    assert.ok(rawBook);
    const book = getBookById(rawBook.id);

    const chapter2 = book.chapters.find(c => c.order_index === 2);
    const chapter2Path = path.join(book.storage_path, chapter2.relative_path);

    // Alterar el archivo en disco simulando una modificación o inyección
    fs.writeFileSync(chapter2Path, '# Capítulo 2\nContenido MODIFICADO por un atacante o error de disco.', 'utf8');

    const report = verifyBookIntegrity(book.id);
    assert.equal(report.status, 'modified', 'El estado global debe indicar modificado');

    const c1 = report.chapters.find(c => c.chapter_number === 1);
    const c2 = report.chapters.find(c => c.chapter_number === 2);

    assert.equal(c1.status, 'verified');
    assert.equal(c2.status, 'modified');
    assert.notEqual(c2.calculated_checksum, c2.stored_checksum);
  });

  await t.test('4. Detecta archivos faltantes (status: missing_files) cuando un archivo es eliminado', () => {
    const rawBook = findBookByCode('INTEG-01');
    assert.ok(rawBook);
    const book = getBookById(rawBook.id);

    const chapter1 = book.chapters.find(c => c.order_index === 1);
    const chapter1Path = path.join(book.storage_path, chapter1.relative_path);

    // Borrar el archivo
    fs.unlinkSync(chapter1Path);

    const report = verifyBookIntegrity(book.id);
    assert.equal(report.status, 'missing_files');

    const c1 = report.chapters.find(c => c.chapter_number === 1);
    assert.equal(c1.status, 'missing');
    assert.equal(c1.calculated_checksum, null);
  });

  await t.test('5. Auditoría global de la biblioteca (verifyLibraryIntegrity)', () => {
    const globalReport = verifyLibraryIntegrity();
    assert.ok(globalReport.total_books >= 1);
    assert.ok(globalReport.books.length >= 1);
    const auditedBook = globalReport.books.find(b => b.code === 'INTEG-01');
    assert.ok(auditedBook);
    assert.equal(auditedBook.status, 'missing_files');
  });

  t.after(() => {
    if (sampleZipPath && fs.existsSync(sampleZipPath)) {
      fs.unlinkSync(sampleZipPath);
    }
  });
});

test('Motor SemVer 2.0.0 (Normalización, Validación, Comparación y Precedencia)', async (t) => {
  await t.test('1. Normaliza versiones flexibles al formato canónico X.Y.Z', () => {
    assert.equal(normalizeSemVer('v1.2.3'), '1.2.3');
    assert.equal(normalizeSemVer('1'), '1.0.0');
    assert.equal(normalizeSemVer('2.5'), '2.5.0');
    assert.equal(normalizeSemVer('v3.0.0-rc.1'), '3.0.0-rc.1');
    assert.equal(normalizeSemVer('v1.0.0+build.42'), '1.0.0+build.42');
    assert.equal(normalizeSemVer(null), '1.0.0');
    assert.equal(normalizeSemVer('invalid_str'), '1.0.0');
  });

  await t.test('2. Valida cadenas según especificación SemVer 2.0.0', () => {
    assert.equal(isValidSemVer('1.0.0'), true);
    assert.equal(isValidSemVer('2.1.3-beta.1'), true);
    assert.equal(isValidSemVer('1.0.0+20130313144700'), true);
    assert.equal(isValidSemVer('v1.0.0'), false); // SemVer estricto no lleva 'v'
    assert.equal(isValidSemVer('1.0'), false);
    assert.equal(isValidSemVer('abc'), false);
  });

  await t.test('3. Compara versiones con precedencia estricta (Major, Minor, Patch y Pre-release)', () => {
    // Major
    assert.equal(compareSemVer('2.0.0', '1.9.9'), 1);
    assert.equal(compareSemVer('1.0.0', '2.0.0'), -1);
    // Minor
    assert.equal(compareSemVer('1.2.0', '1.1.9'), 1);
    assert.equal(compareSemVer('1.1.0', '1.2.0'), -1);
    // Patch
    assert.equal(compareSemVer('1.0.2', '1.0.1'), 1);
    assert.equal(compareSemVer('1.0.0', '1.0.0'), 0);
    // Pre-release (1.0.0 normal > 1.0.0 con prerelease)
    assert.equal(compareSemVer('1.0.0', '1.0.0-alpha'), 1);
    assert.equal(compareSemVer('1.0.0-alpha', '1.0.0'), -1);
    assert.equal(compareSemVer('1.0.0-alpha', '1.0.0-alpha.1'), -1);
    assert.equal(compareSemVer('1.0.0-alpha.1', '1.0.0-alpha.beta'), -1);
    assert.equal(compareSemVer('1.0.0-beta', '1.0.0-alpha'), 1);
  });

  await t.test('4. Clasifica el salto de versión (diffSemVer)', () => {
    assert.equal(diffSemVer('1.0.0', '2.0.0'), 'major');
    assert.equal(diffSemVer('1.0.0', '1.1.0'), 'minor');
    assert.equal(diffSemVer('1.0.0', '1.0.1'), 'patch');
    assert.equal(diffSemVer('1.0.0-alpha', '1.0.0-rc.1'), 'prerelease');
    assert.equal(diffSemVer('1.0.0', '1.0.0'), 'equal');
    assert.equal(diffSemVer('2.0.0', '1.0.0'), 'downgrade');
  });
});

test('Historial de Versiones Inmutables, Estados (draft/published/archived) y Activación', async (t) => {
  const tempFiles = [];

  t.before(() => {
    // Crear v1.0.0
    const zip1 = new AdmZip();
    zip1.addFile('metadata.json', Buffer.from(JSON.stringify({
      code: 'SEMVER-BOOK',
      title: 'Manual de Arquitectura SemVer',
      author: 'Core Team',
      version: '1.0.0',
      state: 'published',
      changelog: 'Versión inicial estable con 2 capítulos.',
      publication_date: '2026-01-01',
      section: 'Arquitectura',
      subsection: 'Patrones',
      chapters: [
        { number: 1, title: 'Capítulo 1: Fundamentos', file: 'c1.md' },
        { number: 2, title: 'Capítulo 2: Microservicios', file: 'c2.md' }
      ]
    })));
    zip1.addFile('c1.md', Buffer.from('# Fundamentos\nTexto original del capítulo 1 sobre conceptos base.'));
    zip1.addFile('c2.md', Buffer.from('# Microservicios\nTexto original del capítulo 2.'));
    const p1 = path.join(__dirname, 'test_semver_v1.zip');
    zip1.writeZip(p1);
    tempFiles.push(p1);

    // Crear v2.0.0 con cambios
    const zip2 = new AdmZip();
    zip2.addFile('metadata.json', Buffer.from(JSON.stringify({
      code: 'SEMVER-BOOK',
      title: 'Manual de Arquitectura SemVer (v2)',
      author: 'Core Team',
      version: '2.0.0',
      state: 'published',
      changelog: 'Breaking change: Reescribe capítulo 1 y añade capítulo 3.',
      publication_date: '2026-02-01',
      section: 'Arquitectura',
      subsection: 'Patrones',
      chapters: [
        { number: 1, title: 'Capítulo 1: Fundamentos Modernos', file: 'c1.md' },
        { number: 2, title: 'Capítulo 2: Microservicios', file: 'c2.md' },
        { number: 3, title: 'Capítulo 3: Event-Driven Architecture', file: 'c3.md' }
      ]
    })));
    zip2.addFile('c1.md', Buffer.from('# Fundamentos Modernos\nTexto COMPLETAMENTE RENOVADO para la versión 2.0.0.'));
    zip2.addFile('c2.md', Buffer.from('# Microservicios\nTexto original del capítulo 2.'));
    zip2.addFile('c3.md', Buffer.from('# Event-Driven Architecture\nNuevo capítulo 3 añadido en la versión 2.0.0.'));
    const p2 = path.join(__dirname, 'test_semver_v2.zip');
    zip2.writeZip(p2);
    tempFiles.push(p2);
  });

  await t.test('1. Ingesta v1.0.0 y comprueba registro en book_versions con estado published', async () => {
    const res1 = await processZipFile(tempFiles[0]);
    assert.ok(res1.id > 0);

    const book = getBookById(res1.id);
    assert.equal(book.version, '1.0.0');
    assert.equal(book.state, 'published');
    assert.equal(book.changelog, 'Versión inicial estable con 2 capítulos.');

    const versions = getBookVersions(book.id);
    assert.equal(versions.length, 1);
    assert.equal(versions[0].version, '1.0.0');
    assert.equal(versions[0].state, 'published');
    assert.ok(versions[0].checksum);
  });

  await t.test('2. Ingesta v2.0.0, archiva la v1.0.0 inmutablemente y activa v2.0.0', async () => {
    const res2 = await processZipFile(tempFiles[1]);
    assert.ok(res2.id > 0);

    const book = getBookById(res2.id);
    assert.equal(book.version, '2.0.0');
    assert.equal(book.title, 'Manual de Arquitectura SemVer (v2)');
    assert.equal(book.chapters.length, 3);

    const versions = getBookVersions(book.id);
    assert.equal(versions.length, 2);

    const v2 = versions.find(v => v.version === '2.0.0');
    const v1 = versions.find(v => v.version === '1.0.0');

    assert.ok(v2);
    assert.ok(v1);
    assert.equal(v2.state, 'published');
    assert.equal(v1.state, 'archived');
    assert.ok(fs.existsSync(v1.storage_path), 'El almacenamiento de la v1 debe permanecer intacto');
    assert.ok(fs.existsSync(v2.storage_path), 'El almacenamiento de la v2 debe existir');
  });

  await t.test('3. Permite actualizar el estado de una versión individual y del libro', () => {
    const book = findBookByCode('SEMVER-BOOK');
    assert.ok(book);

    updateBookState(book.id, 'draft');
    const updatedBook = getBookById(book.id);
    assert.equal(updatedBook.state, 'draft');

    const versions = getBookVersions(book.id);
    const v1 = versions.find(v => v.version === '1.0.0');
    updateVersionState(v1.id, 'draft');
    const updatedV1 = getVersionById(v1.id);
    assert.equal(updatedV1.state, 'draft');
  });

  await t.test('4. Activa y restaura una versión previa (Rollback de versión)', () => {
    const book = findBookByCode('SEMVER-BOOK');
    const versions = getBookVersions(book.id);
    const v1 = versions.find(v => v.version === '1.0.0');

    const result = activateBookVersion(book.id, v1.id);
    assert.equal(result.success, true);
    assert.equal(result.activated_version, '1.0.0');

    const activeBook = getBookById(book.id);
    assert.equal(activeBook.version, '1.0.0');
    assert.equal(activeBook.chapters.length, 2);
  });

  t.after(() => {
    tempFiles.forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  });
});

test('Motor de Comparación de Versiones y Diffing (Capítulos, Contenido y Assets)', async (t) => {
  await t.test('1. computeLineDiff genera correctamente las adiciones, eliminaciones e invariantes', () => {
    const textA = 'Línea 1\nLínea 2 original\nLínea 3';
    const textB = 'Línea 1\nLínea 2 modificada\nLínea 2.5 nueva\nLínea 3';

    const diff = computeLineDiff(textA, textB);
    assert.ok(diff.length >= 4);

    const added = diff.filter(d => d.type === 'added');
    const removed = diff.filter(d => d.type === 'removed');
    const unchanged = diff.filter(d => d.type === 'unchanged');

    assert.ok(added.some(d => d.text === 'Línea 2 modificada'));
    assert.ok(added.some(d => d.text === 'Línea 2.5 nueva'));
    assert.ok(removed.some(d => d.text === 'Línea 2 original'));
    assert.ok(unchanged.some(d => d.text === 'Línea 1'));
    assert.ok(unchanged.some(d => d.text === 'Línea 3'));
  });

  await t.test('2. compareBookVersions produce un reporte exhaustivo de diferencias entre versiones', () => {
    const tempDirA = path.join(TEST_LIB_PATH, 'diff_test_v1');
    const tempDirB = path.join(TEST_LIB_PATH, 'diff_test_v2');

    fs.mkdirSync(path.join(tempDirA, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(tempDirB, 'assets'), { recursive: true });

    // Archivos de capítulos
    fs.writeFileSync(path.join(tempDirA, 'ch1.md'), 'Capítulo 1 versión antigua\nLínea borrada.');
    fs.writeFileSync(path.join(tempDirB, 'ch1.md'), 'Capítulo 1 versión nueva\nLínea añadida.');
    fs.writeFileSync(path.join(tempDirA, 'ch2_old.md'), 'Capítulo que será eliminado en v2.');
    fs.writeFileSync(path.join(tempDirB, 'ch3_new.md'), 'Capítulo nuevo creado exclusivamente en v2.');

    // Assets
    fs.writeFileSync(path.join(tempDirA, 'assets', 'diagram.png'), Buffer.from('image1_data'));
    fs.writeFileSync(path.join(tempDirB, 'assets', 'diagram.png'), Buffer.from('image2_modified_data'));
    fs.writeFileSync(path.join(tempDirB, 'assets', 'logo.svg'), Buffer.from('<svg>logo</svg>'));

    const versionA = {
      id: 101,
      code: 'DIFF-TEST',
      title: 'Libro de Comparación',
      version: '1.0.0',
      state: 'archived',
      storage_path: tempDirA,
      chapters: [
        { order_index: 1, title: 'Cap 1', relative_path: 'ch1.md', checksum: 'hash_a_1', word_count: 6 },
        { order_index: 2, title: 'Cap 2', relative_path: 'ch2_old.md', checksum: 'hash_a_2', word_count: 7 }
      ]
    };

    const versionB = {
      id: 102,
      code: 'DIFF-TEST',
      title: 'Libro de Comparación v2',
      version: '2.0.0',
      state: 'published',
      storage_path: tempDirB,
      chapters: [
        { order_index: 1, title: 'Cap 1 Modificado', relative_path: 'ch1.md', checksum: 'hash_b_1', word_count: 6 },
        { order_index: 3, title: 'Cap 3 Nuevo', relative_path: 'ch3_new.md', checksum: 'hash_b_3', word_count: 7 }
      ]
    };

    const report = compareBookVersions(versionA, versionB, { includeLineDiff: true });

    assert.equal(report.book.code, 'DIFF-TEST');
    assert.equal(report.comparison.semverJump, 'major');
    assert.equal(report.comparison.hasChanges, true);

    // Métricas de capítulos
    const chapSummary = report.comparison.summary.chapters;
    assert.equal(chapSummary.totalA, 2);
    assert.equal(chapSummary.totalB, 2);
    assert.equal(chapSummary.added, 1);
    assert.equal(chapSummary.removed, 1);
    assert.equal(chapSummary.modified, 1);

    // Métricas de assets
    const assetSummary = report.comparison.summary.assets;
    assert.equal(assetSummary.modified, 1);
    assert.equal(assetSummary.added, 1);

    // Validar detalles de capítulos
    const modifiedCh = report.chapters.find(c => c.status === 'modified');
    assert.ok(modifiedCh);
    assert.equal(modifiedCh.relative_path, 'ch1.md');
    assert.ok(modifiedCh.diff.length > 0);

    const addedCh = report.chapters.find(c => c.status === 'added');
    assert.ok(addedCh);
    assert.equal(addedCh.relative_path, 'ch3_new.md');

    const removedCh = report.chapters.find(c => c.status === 'removed');
    assert.ok(removedCh);
    assert.equal(removedCh.relative_path, 'ch2_old.md');
  });
});

test.after(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  if (fs.existsSync(TEST_LIB_PATH)) fs.rmSync(TEST_LIB_PATH, { recursive: true, force: true });
});
