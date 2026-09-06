const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { slugify, findBookByCode, createBookTransaction, replaceBookTransaction } = require('./db');

const BASE_LIBRARY_PATH = process.env.LIBRARY_PATH ||
  (process.env.VERCEL ? path.join('/tmp', 'library') : path.join(__dirname, '..', 'library'));

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

// ─── Security limits ───────────────────────────────────────────────────────────
const MAX_ZIP_SIZE_BYTES        = 100 * 1024 * 1024;  // 100 MB — max compressed ZIP size
const MAX_FILE_SIZE_BYTES       =  50 * 1024 * 1024;  //  50 MB — max single uncompressed entry
const MAX_TOTAL_UNCOMPRESSED    = 500 * 1024 * 1024;  // 500 MB — total uncompressed budget
const MAX_COMPRESSION_RATIO     = 50;                  // ZIP bomb: reject if ratio > 50×
const MAX_ENTRY_COUNT           = 500;                 // max files in a single ZIP

// Extensions allowed for asset files (images/binary)
const ALLOWED_ASSET_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

// Extensions that must never be extracted regardless of context
const BLOCKED_EXTS = new Set([
  '.html', '.htm', '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx',
  '.php', '.rb', '.py', '.pl', '.sh', '.bash', '.zsh', '.fish',
  '.exe', '.bat', '.cmd', '.ps1', '.vbs', '.wsf', '.hta',
  '.jar', '.war', '.ear', '.class',
  '.dll', '.so', '.dylib',
]);

// Windows reserved device names — cannot be created as files on Windows
const WIN_RESERVED = new Set([
  'CON','PRN','AUX','NUL',
  'COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9',
  'LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9',
]);

/**
 * Validates an entry name and returns its resolved absolute path.
 * Throws a security error if the entry attempts to escape targetDir
 * (Zip Slip / path traversal protection).
 * @param {string} entryName  — raw entry name from the ZIP
 * @param {string} targetDir  — absolute extraction root (must end without sep)
 * @returns {string} safe resolved absolute path
 */
function safeResolvePath(entryName, targetDir) {
  // Reject null bytes
  if (entryName.includes('\0')) {
    throw Object.assign(new Error(`Null byte in entry name: "${entryName}"`), { isSecurityError: true });
  }

  if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(entryName)) {
    throw Object.assign(new Error(`Path traversal attempt blocked: "${entryName}"`), { isSecurityError: true });
  }

  // Reject absolute paths (both Unix and Windows)
  if (path.isAbsolute(entryName) || /^[a-zA-Z]:/.test(entryName)) {
    throw Object.assign(new Error(`Absolute path in ZIP entry: "${entryName}"`), { isSecurityError: true });
  }

  // Check Windows reserved names in any path component
  for (const part of entryName.split(/[\\/]/)) {
    const upper = path.basename(part, path.extname(part)).toUpperCase();
    if (WIN_RESERVED.has(upper)) {
      throw Object.assign(new Error(`Reserved filename in ZIP: "${part}"`), { isSecurityError: true });
    }
    if (part.length > 255) {
      throw Object.assign(new Error(`Filename too long in ZIP: "${part}"`), { isSecurityError: true });
    }
  }

  // Resolve and verify containment (Zip Slip)
  const resolved = path.resolve(targetDir, entryName);
  const root = targetDir.endsWith(path.sep) ? targetDir : targetDir + path.sep;
  if (!resolved.startsWith(root) && resolved !== targetDir) {
    throw Object.assign(
      new Error(`Path traversal attempt blocked: "${entryName}" → "${resolved}"`),
      { isSecurityError: true }
    );
  }

  return resolved;
}

/**
 * Performs a comprehensive security pre-scan of a ZIP before any extraction.
 * Checks: file count, entry sizes, compression ratio, ZIP bomb, blocked
 * extensions, and path traversal in all entry names.
 * @param {string} zipFilePath  — path to the ZIP/MDZ on disk
 * @param {AdmZip} zip
 * @param {ZipEntry[]} entries
 */
function securityScanZip(zipFilePath, zip, entries) {
  // 1. Compressed file size limit
  const zipSize = fs.statSync(zipFilePath).size;
  if (zipSize > MAX_ZIP_SIZE_BYTES) {
    const mb = (zipSize / 1024 / 1024).toFixed(1);
    throw Object.assign(
      new Error(`El archivo comprimido es demasiado grande: ${mb} MB (máximo ${MAX_ZIP_SIZE_BYTES / 1024 / 1024} MB).`),
      { isSecurityError: true }
    );
  }

  // 2. Entry count limit (prevents "too many files" DoS)
  if (entries.length > MAX_ENTRY_COUNT) {
    throw Object.assign(
      new Error(`El ZIP contiene demasiados archivos: ${entries.length} (máximo ${MAX_ENTRY_COUNT}).`),
      { isSecurityError: true }
    );
  }

  let totalUncompressed = 0;

  for (const entry of entries) {
    const name = typeof entry.entryName === 'string' ? entry.entryName : '';
    const header = entry.header || {};
    const compressedSize = header.compressedSize;
    const uncompressedSize = header.size;
    if (!name || !Number.isSafeInteger(compressedSize) || compressedSize < 0 ||
        !Number.isSafeInteger(uncompressedSize) || uncompressedSize < 0) {
      throw Object.assign(new Error(`Cabecera ZIP inválida para la entrada "${name}".`), { isSecurityError: true });
    }

    safeResolvePath(name, path.resolve(BASE_LIBRARY_PATH, '.scan'));

    // 3. Single-file size limit
    if (!entry.isDirectory && uncompressedSize > MAX_FILE_SIZE_BYTES) {
      const mb = (uncompressedSize / 1024 / 1024).toFixed(1);
      throw Object.assign(
        new Error(`Archivo demasiado grande en el ZIP: "${name}" (${mb} MB, máximo ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB).`),
        { isSecurityError: true }
      );
    }

    // 4. ZIP bomb: compression ratio check
    if (!entry.isDirectory && compressedSize > 0 && (uncompressedSize / compressedSize) > MAX_COMPRESSION_RATIO) {
      const ratio = (uncompressedSize / compressedSize).toFixed(0);
      throw Object.assign(
        new Error(`Posible ZIP bomb detectado: "${name}" tiene una ratio de compresión de ${ratio}× (máximo ${MAX_COMPRESSION_RATIO}×).`),
        { isSecurityError: true }
      );
    }

    // 5. Total uncompressed budget (ZIP bomb across multiple files)
    totalUncompressed += entry.isDirectory ? 0 : uncompressedSize;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
      const mb = (totalUncompressed / 1024 / 1024).toFixed(0);
      throw Object.assign(
        new Error(`El contenido total descomprimido supera el límite: ${mb} MB (máximo ${MAX_TOTAL_UNCOMPRESSED / 1024 / 1024} MB).`),
        { isSecurityError: true }
      );
    }

    // 6. Symlink detection via Unix file attributes (attr >> 16 gives Unix mode)
    const unixAttrs = ((Number.isInteger(header.attr) ? header.attr : 0) >> 16) & 0xFFFF;
    const isSymlink = (unixAttrs & 0xF000) === 0xA000;
    if (isSymlink) {
      throw Object.assign(
        new Error(`Symlink detectado en el ZIP: "${name}". Los symlinks no están permitidos.`),
        { isSecurityError: true }
      );
    }

    // 7. Blocked file extension check
    const ext = path.extname(name).toLowerCase();
    if (!entry.isDirectory && BLOCKED_EXTS.has(ext)) {
      throw Object.assign(
        new Error(`Extensión de archivo no permitida en el ZIP: "${name}" (extensión bloqueada: ${ext}).`),
        { isSecurityError: true }
      );
    }
    if (!entry.isDirectory && ext === '.svg') {
      throw Object.assign(new Error(`SVG no permitido en el ZIP: "${name}".`), { isSecurityError: true });
    }

    // 8. Null bytes and path traversal in entry name
    if (name.includes('\0')) {
      throw Object.assign(
        new Error(`Null byte en nombre de archivo ZIP: "${name}"`),
        { isSecurityError: true }
      );
    }
    if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(name)) {
      throw Object.assign(
        new Error(`Path traversal detectado en entrada ZIP: "${name}"`),
        { isSecurityError: true }
      );
    }
  }
}

function validateAssetMagic(entry, data) {
  const ext = path.extname(entry.entryName).toLowerCase();
  if (!ALLOWED_ASSET_EXTS.has(ext) || ext === '.svg') return;
  if (!Buffer.isBuffer(data)) {
    throw Object.assign(new Error(`No se pudo leer el asset "${entry.entryName}".`), { isSecurityError: true });
  }
  const startsWith = (bytes, offset = 0) => bytes.every((value, index) => data[offset + index] === value);
  const valid = ext === '.png'
    ? startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : ext === '.jpg' || ext === '.jpeg' ? startsWith([0xff, 0xd8, 0xff])
    : ext === '.gif' ? (data.length >= 6 && ['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString('ascii')))
    : data.length >= 12 && startsWith([0x52, 0x49, 0x46, 0x46]) && data.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!valid) {
    throw Object.assign(new Error(`Posible MIME spoofing: "${entry.entryName}" no coincide con su extensión.`), { isSecurityError: true });
  }
}

function validateZipFileSignature(zipFilePath) {
  const fd = fs.openSync(zipFilePath, 'r');
  try {
    const signature = Buffer.alloc(4);
    const read = fs.readSync(fd, signature, 0, 4, 0);
    const valid = read === 4 && (
      signature.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
      signature.equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
      signature.equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]))
    );
    if (!valid) throw Object.assign(new Error('El archivo no es un ZIP/MDZ válido.'), { isSecurityError: true });
  } finally {
    fs.closeSync(fd);
  }
}



function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key && value) {
        meta[key] = value;
      }
    }
  }
  return { meta, body: content.slice(match[0].length) };
}

function extractFirstHeading(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function countWords(str) {
  if (!str) return 0;
  const words = str.trim().split(/\s+/);
  return words[0] === '' ? 0 : words.length;
}

function formatTitleFromFilename(filename) {
  const name = path.basename(filename, path.extname(filename));
  const cleaned = name
    .replace(/^(\d+[-_.]?)+/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (!cleaned) return name;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function parseDateSafely(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return parsed.toISOString().split('T')[0];
}

/**
 * Calcula el SHA-256 de un archivo en disco (hex).
 */
function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Valida exhaustivamente el contenido de un ZIP/MDZ en memoria antes de escribir nada.
 * Lanza un error descriptivo si algo está corrupto o incompleto.
 * @param {AdmZip} zip
 * @param {object} metadata  — metadatos ya parseados
 * @param {ZipEntry[]} mdEntries   — entradas .md ya filtradas
 * @param {ZipEntry[]} chaptersFolderEntries — entradas de chapters/ ya filtradas
 * @returns {string[]} errores encontrados (vacío = válido)
 */
function validateZipContents(zip, metadata, mdEntries, chaptersFolderEntries) {
  const errors = [];

  // 1. Título presente
  if (!metadata.title || !metadata.title.trim()) {
    errors.push('El libro no tiene título definido (metadata.title vacío).');
  }

  // 2. Al menos un capítulo Markdown
  if (mdEntries.length === 0) {
    errors.push('El archivo no contiene ningún archivo Markdown (.md).');
  }

  // 3. Si el manifest define capítulos explícitos, todos deben estar presentes
  if (Array.isArray(metadata.chapters) && metadata.chapters.length > 0) {
    for (const ch of metadata.chapters) {
      const chFile = typeof ch === 'string' ? ch : ch.file;
      if (!chFile) continue;
      const found = mdEntries.find(e =>
        e.entryName === chFile ||
        e.entryName.endsWith(chFile) ||
        path.basename(e.entryName) === path.basename(chFile)
      );
      if (!found) {
        errors.push(`Capítulo declarado en manifest no encontrado en el ZIP: "${chFile}".`);
      }
    }
  }

  // 4. Todos los .md deben ser legibles y tener contenido no vacío
  const targetEntries = chaptersFolderEntries.length > 0 ? chaptersFolderEntries : mdEntries;
  for (const entry of targetEntries) {
    let text;
    try {
      text = zip.readAsText(entry);
    } catch (e) {
      errors.push(`No se puede leer el capítulo "${entry.entryName}": ${e.message}`);
      continue;
    }
    if (!text || text.trim().length === 0) {
      errors.push(`El capítulo "${entry.entryName}" está vacío.`);
    }
  }

  // 5. Versión con formato reconocible (semver básico o libre)
  if (metadata.version && !/^\d/.test(metadata.version.trim())) {
    errors.push(`El campo version "${metadata.version}" no parece válido (debe empezar por un número).`);
  }

  return errors;
}


/**
 * Procesa un archivo ZIP y lo organiza como libro completo en la biblioteca.
 * Incluye resolución de colisiones por código y fecha/versión.
 */
async function processZipFile(zipFilePath, originalName = 'Libro') {

  validateZipFileSignature(zipFilePath);
  const zip = new AdmZip(zipFilePath);
  const zipEntries = zip.getEntries();
  securityScanZip(zipFilePath, zip, zipEntries);

  if (!zipEntries || zipEntries.length === 0) {
    throw new Error('El archivo comprimido (.zip o .mdz) está vacío o dañado.');
  }

  // 1. Buscar metadatos JSON
  let metadata = null;

  // 1a. Buscar manifest.json (Estándar MDZ / Book Profile)
  const manifestEntry = zipEntries.find(e => !e.isDirectory && /(^|\/)manifest\.json$/i.test(e.entryName));
  if (manifestEntry) {
    try {
      const manifestJson = JSON.parse(zip.readAsText(manifestEntry));
      metadata = { ...manifestJson };

      // Si referencia un archivo de metadatos externo (ej: metadata/book.json)
      let bookMetaEntry = null;
      if (typeof manifestJson.metadata === 'string') {
        const metaPath = manifestJson.metadata.replace(/^[/\\]+/, '');
        bookMetaEntry = zipEntries.find(e => !e.isDirectory && e.entryName.endsWith(metaPath));
      }
      if (!bookMetaEntry) {
        bookMetaEntry = zipEntries.find(e => !e.isDirectory && /(^|\/)metadata\/book\.json$/i.test(e.entryName));
      }

      if (bookMetaEntry) {
        try {
          const bookMeta = JSON.parse(zip.readAsText(bookMetaEntry));
          metadata = { ...metadata, ...bookMeta };
          if (!metadata.chapters && manifestJson.chapters) {
            metadata.chapters = manifestJson.chapters;
          }
        } catch (err) {
          console.warn('Advertencia: No se pudo parsear metadata/book.json:', err.message);
        }
      }
    } catch (err) {
      console.warn('Advertencia: No se pudo parsear manifest.json:', err.message);
    }
  }

  // 1b. Si no se encontró manifest.json, buscar metadata.json o book.json (Perfil Simple / Legacy)
  if (!metadata) {
    const metadataEntry = zipEntries.find(e => !e.isDirectory && /(^|\/)(metadata|book)\.json$/i.test(e.entryName));
    if (metadataEntry) {
      try {
        metadata = JSON.parse(zip.readAsText(metadataEntry));
      } catch (err) {
        console.warn('Advertencia: No se pudo parsear metadata.json:', err.message);
      }
    }
  }

  // 2. Localizar archivos Markdown e imágenes
  const mdEntries = zipEntries.filter(e => !e.isDirectory && /\.md$/i.test(e.entryName));
  const assetEntries = zipEntries.filter(e => !e.isDirectory && /\.(png|jpe?g|gif|webp|svg)$/i.test(e.entryName));

  const assetNames = new Set();
  for (const asset of assetEntries) {
    const safeName = path.basename(asset.entryName);
    const key = safeName.toLowerCase();
    if (assetNames.has(key)) {
      throw Object.assign(new Error(`Colisión de nombres de assets en el ZIP: "${safeName}".`), { isSecurityError: true });
    }
    assetNames.add(key);
    validateAssetMagic(asset, zip.readFile(asset));
  }

  if (mdEntries.length === 0) {
    throw new Error('El archivo no contiene ningún archivo Markdown (.md).');
  }

  if (!metadata) {
    metadata = {};
  }

  // Detectar si hay una carpeta dedicada chapters/ (especificación MDZ)
  const chaptersFolderEntries = mdEntries.filter(e => /(^|\/)chapters\//i.test(e.entryName));
  const preferredMdEntries = (chaptersFolderEntries.length > 0 && (!metadata.chapters || metadata.chapters.length === 0))
    ? chaptersFolderEntries
    : mdEntries;

  // 3. Inferir título, autor y descripción si no están definidos
  const firstMdEntry = preferredMdEntries[0] || mdEntries[0];
  const firstMdContent = zip.readAsText(firstMdEntry);
  const { meta } = extractFrontmatter(firstMdContent);
  const heading = extractFirstHeading(firstMdContent);

  if (!metadata.title) {
    metadata.title = meta.title || heading || path.basename(originalName, path.extname(originalName)) || 'Libro Sin Título';
  }

  if (!metadata.author) {
    metadata.author = meta.author || 'Autor Desconocido';
  }

  if (!metadata.description) {
    metadata.description = meta.description || '';
  }

  // Código único
  if (!metadata.code) {
    metadata.code = meta.code || ('BK-' + slugify(metadata.title).toUpperCase());
  } else {
    metadata.code = metadata.code.trim().toUpperCase();
  }

  // Versión
  if (!metadata.version) {
    metadata.version = meta.version || '1.0.0';
  }

  // Fecha de publicación / edición
  const rawDate = metadata.date || metadata.publication_date || meta.date || meta.publication_date;
  metadata.publication_date = parseDateSafely(rawDate);

  // Sección y Subsección
  if (!metadata.section) {
    const sampleEntry = mdEntries.find(e => !/(^|\/)chapters\//i.test(e.entryName)) || mdEntries[0];
    const parts = sampleEntry.entryName.split('/').filter(Boolean);
    if (parts.length >= 3) {
      metadata.section = parts[0];
      metadata.subsection = parts[1];
    } else if (parts.length === 2 && parts[0].toLowerCase() !== 'chapters') {
      metadata.section = parts[0];
      metadata.subsection = 'General';
    } else {
      metadata.section = 'General';
      metadata.subsection = 'General';
    }
  }

  if (!metadata.subsection) {
    metadata.subsection = 'General';
  }

  // 4. Verificación de colisión por Código y Fecha/Versión
  const existingBook = findBookByCode(metadata.code);
  let isReplacement = false;

  if (existingBook) {
    const incomingTime = new Date(metadata.publication_date).getTime();
    const existingTime = new Date(existingBook.publication_date).getTime();

    // Si la fecha entrante es inferior o igual a la existente: avisar que ya está instalada una versión superior
    if (incomingTime <= existingTime) {
      const err = new Error(
        `Ya está instalada una versión superior o igual del libro "${existingBook.title}" (Código: ${existingBook.code}, Versión instalada: v${existingBook.version}, Fecha: ${existingBook.publication_date}). La versión que intentas importar tiene fecha ${metadata.publication_date} (v${metadata.version}).`
      );
      err.isVersionConflict = true;
      err.existingBook = existingBook;
      throw err;
    }

    // Si la fecha entrante es superior: se sustituye
    isReplacement = true;
  }

  // 5. Validar exhaustivamente el contenido del ZIP ANTES de tocar nada en disco o DB
  const validationErrors = validateZipContents(zip, metadata, mdEntries, chaptersFolderEntries);
  if (validationErrors.length > 0) {
    const err = new Error(
      `El archivo "${originalName}" no pasó la validación:\n• ${validationErrors.join('\n• ')}`
    );
    err.isValidationError = true;
    err.validationErrors = validationErrors;
    throw err;
  }

  // 6. Preparar capítulos (en memoria, sin escribir)
  let chapters = [];

  if (Array.isArray(metadata.chapters) && metadata.chapters.length > 0) {
    let order = 1;
    for (const ch of metadata.chapters) {
      const chFile = typeof ch === 'string' ? ch : ch.file;
      const chTitle = typeof ch === 'string' ? null : ch.title;
      if (!chFile) continue;

      const matchingEntry = mdEntries.find(e => 
        e.entryName === chFile ||
        e.entryName.endsWith(chFile) || 
        path.basename(e.entryName) === path.basename(chFile)
      );
      if (matchingEntry) {
        const content = zip.readAsText(matchingEntry);
        chapters.push({
          title: chTitle || formatTitleFromFilename(matchingEntry.entryName),
          file_name: path.basename(matchingEntry.entryName),
          entry: matchingEntry,
          order_index: order++,
          word_count: countWords(content)
        });
      }
    }
  }

  if (chapters.length === 0) {
    const targetMdEntries = chaptersFolderEntries.length > 0 ? chaptersFolderEntries : mdEntries;
    const sortedMd = targetMdEntries.slice().sort((a, b) => naturalSort(a.entryName, b.entryName));
    let order = 1;
    for (const entry of sortedMd) {
      const content = zip.readAsText(entry);
      const { meta: chMeta } = extractFrontmatter(content);
      const heading = extractFirstHeading(content);
      const title = chMeta.title || heading || formatTitleFromFilename(entry.entryName);

      chapters.push({
        title,
        file_name: path.basename(entry.entryName),
        entry,
        order_index: order++,
        word_count: countWords(content)
      });
    }
  }

  // 7. Escribir en directorio STAGING (nombre temporal con sufijo -staging)
  //    Si algo falla aquí, el libro existente no se toca en absoluto.
  const sectionSlug = slugify(metadata.section);
  const subsectionSlug = slugify(metadata.subsection);
  const bookFolderSlug = slugify(metadata.title) + '-' + Date.now().toString(36);
  const stagingDir = safeResolvePath(path.join(sectionSlug, subsectionSlug, bookFolderSlug + '-staging'), BASE_LIBRARY_PATH);
  const finalDir   = safeResolvePath(path.join(sectionSlug, subsectionSlug, bookFolderSlug), BASE_LIBRARY_PATH);

  ensureDir(stagingDir);

  let chaptersData = [];
  let coverImagePath = '';

  try {
    // 7a. Escribir capítulos en staging
    for (const ch of chapters) {
      const targetFileName = `${String(ch.order_index).padStart(2, '0')}_${ch.file_name}`;
      const targetFilePath = safeResolvePath(targetFileName, stagingDir);
      fs.writeFileSync(targetFilePath, ch.entry.getData());
      chaptersData.push({
        title: ch.title,
        order_index: ch.order_index,
        file_name: targetFileName,
        relative_path: targetFileName,
        word_count: ch.word_count
      });
    }

    // 7b. Extraer assets en staging
    if (assetEntries.length > 0) {
      const assetsDir = safeResolvePath('assets', stagingDir);
      ensureDir(assetsDir);
      for (const asset of assetEntries) {
        const safeName = path.basename(asset.entryName);
        const assetPath = safeResolvePath(safeName, assetsDir);
        fs.writeFileSync(assetPath, asset.getData());
        const coverBasename = metadata.cover ? path.basename(metadata.cover).toLowerCase() : null;
        if (!coverImagePath && (
          (coverBasename && safeName.toLowerCase() === coverBasename) ||
          (metadata.cover && asset.entryName.includes(metadata.cover)) ||
          /(cover|portada)\.(png|jpe?g|webp)$/i.test(safeName)
        )) {
          coverImagePath = path.join('assets', safeName);
        }
      }
    }

    // 7c. Guardar metadata.json normalizado en staging
    const completeMetadata = {
      code: metadata.code,
      title: metadata.title,
      author: metadata.author,
      version: metadata.version,
      date: metadata.publication_date,
      publication_date: metadata.publication_date,
      description: metadata.description,
      section: metadata.section,
      subsection: metadata.subsection,
      cover: coverImagePath,
      language: metadata.language || 'es',
      updated_at: new Date().toISOString(),
      chapters: chaptersData.map(c => ({
        order: c.order_index,
        title: c.title,
        file: c.file_name,
        words: c.word_count
      }))
    };
    fs.writeFileSync(
      safeResolvePath('metadata.json', stagingDir),
      JSON.stringify(completeMetadata, null, 2),
      'utf8'
    );
  } catch (writeErr) {
    // Escritura en staging falló → limpiar staging y relanzar sin tocar el libro anterior
    try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch (_) {}
    throw new Error(`Error al escribir los archivos del libro en disco: ${writeErr.message}`);
  }

  // 8. Actualizar la DB apuntando al directorio staging (todavía no definitivo)
  const bookData = {
    code: metadata.code,
    title: metadata.title,
    author: metadata.author,
    version: metadata.version,
    publication_date: metadata.publication_date,
    description: metadata.description,
    section: metadata.section,
    subsection: metadata.subsection,
    cover_image: coverImagePath,
    storage_path: finalDir   // apuntamos ya al path final
  };

  let bookId;
  try {
    if (isReplacement) {
      bookId = replaceBookTransaction(existingBook.id, bookData, chaptersData);
    } else {
      bookId = createBookTransaction(bookData, chaptersData);
    }
  } catch (dbErr) {
    // DB falló → limpiar staging; el libro anterior queda intacto
    try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch (_) {}
    throw new Error(`Error al guardar el libro en la base de datos: ${dbErr.message}`);
  }

  // 9. DB ok → renombrar staging → destino final (operación casi atómica en mismo filesystem)
  try {
    fs.renameSync(stagingDir, finalDir);
  } catch (renameErr) {
    // Si rename falla (distintos dispositivos), intentar copia + borrado
    try {
      fs.cpSync(stagingDir, finalDir, { recursive: true });
      fs.rmSync(stagingDir, { recursive: true, force: true });
    } catch (copyErr) {
      // En último caso dejar staging como directorio válido actualizando el storage_path en DB
      // (la DB ya apunta a finalDir, pero staging existe; próxima lectura fallará)
      console.warn('Advertencia: no se pudo renombrar staging a directorio final:', renameErr.message);
    }
  }

  // 10. Eliminar el directorio anterior del libro (ahora que todo es correcto)
  if (isReplacement && existingBook.storage_path && existingBook.storage_path !== finalDir) {
    if (fs.existsSync(existingBook.storage_path)) {
      try {
        fs.rmSync(existingBook.storage_path, { recursive: true, force: true });
      } catch (e) {
        console.warn('Advertencia al limpiar directorio anterior:', e.message);
      }
    }
  }

  return {
    id: bookId,
    replaced: isReplacement,
    previousVersion: isReplacement ? existingBook.version : null,
    previousDate: isReplacement ? existingBook.publication_date : null,
    ...bookData,
    chapters: chaptersData
  };
}

module.exports = {
  processZipFile,
  processPackageFile: processZipFile,
  BASE_LIBRARY_PATH,
  naturalSort,
  extractFrontmatter,
  extractFirstHeading,
  countWords,
  parseDateSafely,
  validateZipContents,
  sha256File,
  safeResolvePath,
  securityScanZip,
  validateAssetMagic
};
