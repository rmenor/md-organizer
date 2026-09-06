const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const AdmZip = require('adm-zip');
const { slugify, findBookByCode, createBookTransaction, replaceBookTransaction } = require('./db');
const { normalizeSemVer, compareSemVer, diffSemVer } = require('./semver');

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
 * Ignora de forma segura los metadatos ocultos de macOS (__MACOSX, ._*, .DS_Store).
 * @param {string} zipFilePath  — path to the ZIP/MDZ on disk
 * @param {object} zip
 * @param {object[]} entries
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

  // Filtrar metadatos de macOS para el análisis de seguridad
  const realEntries = entries.filter(e => {
    const name = typeof e.entryName === 'string' ? e.entryName : '';
    return !name.startsWith('__MACOSX/') &&
           !path.basename(name).startsWith('._') &&
           !name.endsWith('.DS_Store');
  });

  // 2. Entry count limit sobre archivos reales (evita DoS por millones de archivos)
  if (realEntries.length > MAX_ENTRY_COUNT) {
    throw Object.assign(
      new Error(`El ZIP contiene demasiados archivos: ${realEntries.length} (máximo ${MAX_ENTRY_COUNT}).`),
      { isSecurityError: true }
    );
  }

  let totalUncompressed = 0;

  for (const entry of realEntries) {
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

    // 4. ZIP bomb: compression ratio check (solo en archivos con contenido relevante)
    if (!entry.isDirectory && compressedSize > 128 && uncompressedSize > 1024 && (uncompressedSize / compressedSize) > MAX_COMPRESSION_RATIO) {
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

    // 6. Symlink detection via Unix file attributes
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
 * Lector de ZIP robusto basado en zlib nativo de Node.js.
 * Se utiliza automáticamente como fallback si ADM-ZIP falla ante particularidades
 * del compresor de macOS (ej: "ADM-ZIP: Number of disk entries is too large", ZIP64 o metadatos extendidos).
 */
function parseZipFallback(buffer) {
  const entries = [];

  // 1. Intentar leer desde el Central Directory (PK\x01\x02)
  for (let i = 0; i <= buffer.length - 46; i++) {
    if (buffer.readUInt32LE(i) === 0x02014b50) {
      const flags = buffer.readUInt16LE(i + 8);
      const method = buffer.readUInt16LE(i + 10);
      let compSize = buffer.readUInt32LE(i + 20);
      let uncompSize = buffer.readUInt32LE(i + 24);
      const nameLen = buffer.readUInt16LE(i + 28);
      const extraLen = buffer.readUInt16LE(i + 30);
      const commentLen = buffer.readUInt16LE(i + 32);
      let localOffset = buffer.readUInt32LE(i + 42);

      if (i + 46 + nameLen <= buffer.length) {
        const fileName = buffer.subarray(i + 46, i + 46 + nameLen).toString('utf8');

        // Procesar campo extra ZIP64 si es necesario
        if (extraLen > 0 && i + 46 + nameLen + extraLen <= buffer.length) {
          let extraPos = i + 46 + nameLen;
          const extraEnd = extraPos + extraLen;
          while (extraPos + 4 <= extraEnd) {
            const headerId = buffer.readUInt16LE(extraPos);
            const dataSize = buffer.readUInt16LE(extraPos + 2);
            extraPos += 4;
            if (headerId === 0x0001 && extraPos + dataSize <= extraEnd) {
              let p = extraPos;
              if (uncompSize === 0xFFFFFFFF && p + 8 <= extraEnd) {
                uncompSize = Number(buffer.readBigUInt64LE(p));
                p += 8;
              }
              if (compSize === 0xFFFFFFFF && p + 8 <= extraEnd) {
                compSize = Number(buffer.readBigUInt64LE(p));
                p += 8;
              }
              if (localOffset === 0xFFFFFFFF && p + 8 <= extraEnd) {
                localOffset = Number(buffer.readBigUInt64LE(p));
                p += 8;
              }
            }
            extraPos += dataSize;
          }
        }

        const isDirectory = fileName.endsWith('/');
        const currentCompSize = compSize;
        const currentUncompSize = uncompSize;
        const currentMethod = method;
        const currentLocalOffset = localOffset;

        entries.push({
          entryName: fileName,
          isDirectory,
          header: {
            size: currentUncompSize,
            compressedSize: currentCompSize,
            method: currentMethod
          },
          getData: () => {
            if (isDirectory || currentUncompSize === 0) return Buffer.alloc(0);
            if (currentLocalOffset + 30 > buffer.length || buffer.readUInt32LE(currentLocalOffset) !== 0x04034b50) {
              throw new Error(`Cabecera local corrupta para "${fileName}"`);
            }
            const locNameLen = buffer.readUInt16LE(currentLocalOffset + 26);
            const locExtraLen = buffer.readUInt16LE(currentLocalOffset + 28);
            const dataStart = currentLocalOffset + 30 + locNameLen + locExtraLen;
            const slice = buffer.subarray(dataStart, dataStart + currentCompSize);

            if (currentMethod === 0) {
              return Buffer.from(slice);
            } else if (currentMethod === 8) {
              return zlib.inflateRawSync(slice);
            } else {
              throw new Error(`Método de compresión no soportado (${currentMethod}) en "${fileName}"`);
            }
          }
        });

        i += 46 + nameLen + extraLen + commentLen - 1;
      }
    }
  }

  // 2. Si no se encontraron entradas en el Central Directory, escanear cabeceras locales (PK\x03\x04)
  if (entries.length === 0) {
    let pos = 0;
    while (pos <= buffer.length - 30) {
      if (buffer.readUInt32LE(pos) === 0x04034b50) {
        const method = buffer.readUInt16LE(pos + 8);
        const compSize = buffer.readUInt32LE(pos + 18);
        const uncompSize = buffer.readUInt32LE(pos + 22);
        const nameLen = buffer.readUInt16LE(pos + 26);
        const extraLen = buffer.readUInt16LE(pos + 28);
        const fileName = buffer.subarray(pos + 30, pos + 30 + nameLen).toString('utf8');
        const isDirectory = fileName.endsWith('/');
        const dataStart = pos + 30 + nameLen + extraLen;

        const currentCompSize = compSize;
        const currentUncompSize = uncompSize;
        const currentMethod = method;

        entries.push({
          entryName: fileName,
          isDirectory,
          header: {
            size: currentUncompSize,
            compressedSize: currentCompSize,
            method: currentMethod
          },
          getData: () => {
            if (isDirectory || currentUncompSize === 0) return Buffer.alloc(0);
            const slice = buffer.subarray(dataStart, dataStart + currentCompSize);
            if (currentMethod === 0) {
              return Buffer.from(slice);
            } else if (currentMethod === 8) {
              return zlib.inflateRawSync(slice);
            } else {
              throw new Error(`Método de compresión no soportado (${currentMethod})`);
            }
          }
        });

        pos = dataStart + compSize;
      } else {
        pos++;
      }
    }
  }

  return {
    getEntries: () => entries,
    readAsText: (entry) => entry.getData().toString('utf8'),
    readFile: (entry) => entry.getData()
  };
}

/**
 * Carga un archivo ZIP intentando primero con AdmZip y cayendo en parseZipFallback si falla.
 */
function loadZipArchive(zipFilePath) {
  try {
    const zip = new AdmZip(zipFilePath);
    const entries = zip.getEntries();
    if (entries && entries.length > 0) {
      return zip;
    }
  } catch (err) {
    console.warn(`[ZIP Reader] AdmZip no pudo procesar el archivo (${err.message}). Utilizando lector nativo zlib.`);
  }

  const buffer = fs.readFileSync(zipFilePath);
  return parseZipFallback(buffer);
}

/**
 * Procesa un archivo ZIP y lo organiza como libro completo en la biblioteca.
 * Incluye resolución de colisiones por código y fecha/versión.
 */
async function processZipFile(zipFilePath, originalName = 'Libro') {

  validateZipFileSignature(zipFilePath);
  const zip = loadZipArchive(zipFilePath);
  const zipEntries = zip.getEntries();

  // Escaneo de seguridad (Zip Slip, ZIP bomb, extensiones no permitidas, tamaños)
  securityScanZip(zipFilePath, zip, zipEntries);

  if (!zipEntries || zipEntries.length === 0) {
    throw new Error('El archivo comprimido (.zip o .mdz) está vacío o dañado.');
  }

  // 1. Buscar metadatos JSON (ignorando entradas de __MACOSX)
  let metadata = null;

  // 1a. Buscar manifest.json (Estándar MDZ / Book Profile)
  const manifestEntry = zipEntries.find(e => !e.isDirectory && !e.entryName.startsWith('__MACOSX/') && !path.basename(e.entryName).startsWith('._') && /(^|\/)manifest\.json$/i.test(e.entryName));
  if (manifestEntry) {
    try {
      const manifestJson = JSON.parse(zip.readAsText(manifestEntry));
      metadata = { ...manifestJson };

      // Si referencia un archivo de metadatos externo (ej: metadata/book.json)
      let bookMetaEntry = null;
      if (typeof manifestJson.metadata === 'string') {
        const metaPath = manifestJson.metadata.replace(/^[/\\]+/, '');
        bookMetaEntry = zipEntries.find(e => !e.isDirectory && !e.entryName.startsWith('__MACOSX/') && e.entryName.endsWith(metaPath));
      }
      if (!bookMetaEntry) {
        bookMetaEntry = zipEntries.find(e => !e.isDirectory && !e.entryName.startsWith('__MACOSX/') && /(^|\/)metadata\/book\.json$/i.test(e.entryName));
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
    const metadataEntry = zipEntries.find(e => !e.isDirectory && !e.entryName.startsWith('__MACOSX/') && !path.basename(e.entryName).startsWith('._') && /(^|\/)(metadata|book)\.json$/i.test(e.entryName));
    if (metadataEntry) {
      try {
        metadata = JSON.parse(zip.readAsText(metadataEntry));
      } catch (err) {
        console.warn('Advertencia: No se pudo parsear metadata.json:', err.message);
      }
    }
  }

  // 2. Localizar archivos Markdown e imágenes (filtrando basura oculta de macOS como __MACOSX y ._*)
  const mdEntries = zipEntries.filter(e => !e.isDirectory && !e.entryName.startsWith('__MACOSX/') && !path.basename(e.entryName).startsWith('._') && /\.md$/i.test(e.entryName));
  const assetEntries = zipEntries.filter(e => !e.isDirectory && !e.entryName.startsWith('__MACOSX/') && !path.basename(e.entryName).startsWith('._') && /\.(png|jpe?g|gif|webp|svg)$/i.test(e.entryName));

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

  // Versión SemVer
  metadata.version = normalizeSemVer(metadata.version || meta.version || '1.0.0');

  // Changelog
  let changelogText = '';
  if (metadata.changelog) {
    if (Array.isArray(metadata.changelog)) {
      changelogText = metadata.changelog.map(item => typeof item === 'string' ? `• ${item}` : `• ${JSON.stringify(item)}`).join('\n');
    } else {
      changelogText = String(metadata.changelog).trim();
    }
  } else if (meta.changelog) {
    changelogText = String(meta.changelog).trim();
  }
  metadata.changelog = changelogText;

  // Estado de ciclo de vida ('draft' | 'published' | 'archived')
  const allowedStates = ['draft', 'published', 'archived'];
  const rawState = String(metadata.state || meta.state || 'published').toLowerCase().trim();
  metadata.state = allowedStates.includes(rawState) ? rawState : 'published';

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

  // 4. Verificación de colisión por Código y Fecha/Versión (SemVer 2.0.0)
  const existingBook = findBookByCode(metadata.code);
  let isReplacement = false;

  if (existingBook) {
    const semverComp = compareSemVer(metadata.version, existingBook.version);
    const incomingTime = new Date(metadata.publication_date).getTime();
    const existingTime = new Date(existingBook.publication_date).getTime();

    // Actualización válida si SemVer es mayor, o si es igual y la fecha es superior, o si ambos son draft
    const isNewerSemver = semverComp > 0;
    const isSameSemverNewerDate = semverComp === 0 && incomingTime > existingTime;
    const isDraftUpdate = existingBook.state === 'draft' && metadata.state === 'draft';

    if (isNewerSemver || isSameSemverNewerDate || isDraftUpdate) {
      isReplacement = true;
    } else {
      const err = new Error(
        `Ya está instalada una versión superior o igual del libro "${existingBook.title}" (Código: ${existingBook.code}, Versión instalada: v${existingBook.version}, Fecha: ${existingBook.publication_date}). La versión que intentas importar tiene fecha ${metadata.publication_date} (v${metadata.version}).`
      );
      err.isVersionConflict = true;
      err.existingBook = existingBook;
      throw err;
    }
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
  const bookFolderSlug = slugify(metadata.title) + '-v' + slugify(metadata.version) + '-' + Date.now().toString(36);
  const stagingDir = safeResolvePath(path.join(sectionSlug, subsectionSlug, bookFolderSlug + '-staging'), BASE_LIBRARY_PATH);
  const finalDir   = safeResolvePath(path.join(sectionSlug, subsectionSlug, bookFolderSlug), BASE_LIBRARY_PATH);

  ensureDir(stagingDir);

  let chaptersData = [];
  let coverImagePath = '';
  let compositeBookChecksum = '';

  try {
    // 7a. Escribir capítulos en staging y calcular hash SHA-256
    for (const ch of chapters) {
      const targetFileName = `${String(ch.order_index).padStart(2, '0')}_${ch.file_name}`;
      const targetFilePath = safeResolvePath(targetFileName, stagingDir);
      const chData = ch.entry.getData();
      const chapterChecksum = crypto.createHash('sha256').update(chData).digest('hex');
      fs.writeFileSync(targetFilePath, chData);
      chaptersData.push({
        title: ch.title,
        order_index: ch.order_index,
        file_name: targetFileName,
        relative_path: targetFileName,
        word_count: ch.word_count,
        checksum: chapterChecksum
      });
    }

    // Calcular hash SHA-256 canónico del libro completo
    compositeBookChecksum = crypto.createHash('sha256')
      .update(`${metadata.code}:${metadata.version}:${chaptersData.map(c => c.checksum).join(':')}`)
      .digest('hex');

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

    // 7c. Guardar metadata.json normalizado en staging con checksums
    const completeMetadata = {
      code: metadata.code,
      title: metadata.title,
      author: metadata.author,
      version: metadata.version,
      state: metadata.state,
      changelog: metadata.changelog,
      date: metadata.publication_date,
      publication_date: metadata.publication_date,
      description: metadata.description,
      section: metadata.section,
      subsection: metadata.subsection,
      cover: coverImagePath,
      language: metadata.language || 'es',
      checksum: compositeBookChecksum,
      updated_at: new Date().toISOString(),
      chapters: chaptersData.map(c => ({
        order: c.order_index,
        title: c.title,
        file: c.file_name,
        words: c.word_count,
        checksum: c.checksum
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
    state: metadata.state,
    changelog: metadata.changelog,
    publication_date: metadata.publication_date,
    description: metadata.description,
    section: metadata.section,
    subsection: metadata.subsection,
    cover_image: coverImagePath,
    storage_path: finalDir,   // apuntamos ya al path final
    checksum: compositeBookChecksum
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
      console.warn('Advertencia: no se pudo renombrar staging a directorio final:', renameErr.message);
    }
  }

  // 10. Limpieza: si la versión anterior era un borrador ('draft'), eliminar el directorio del borrador obsoleto.
  // Las versiones publicadas ('published' o 'archived') se conservan de forma inmutable para histórico y comparaciones.
  if (isReplacement && existingBook.state === 'draft' && existingBook.storage_path && existingBook.storage_path !== finalDir) {
    if (fs.existsSync(existingBook.storage_path)) {
      try {
        fs.rmSync(existingBook.storage_path, { recursive: true, force: true });
      } catch (e) {
        console.warn('Advertencia al limpiar borrador anterior:', e.message);
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
  validateAssetMagic,
  loadZipArchive
};
