const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const Database = require('better-sqlite3');
const {
  DB_PATH,
  backupDatabase,
  reopenDatabase,
  closeDatabase,
  remapStoragePaths,
  getDatabaseStats
} = require('./db');
const {
  BASE_LIBRARY_PATH,
  safeResolvePath,
  securityScanZip,
  sha256File,
  loadZipArchive
} = require('./processor');

const BACKUP_FORMAT = 'athenaeum-backup';
const BACKUP_VERSION = '1.0';
const APP_VERSION = '1.0.0';
const SQLITE_HEADER = Buffer.from('SQLite format 3\0');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Agrega recursivamente una carpeta local al archivo ZIP bajo un prefijo relativo.
 */
function addDirectoryToZip(zip, localDir, zipPrefix = '') {
  if (!fs.existsSync(localDir)) return;
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(localDir, entry.name);
    const zipPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDirectoryToZip(zip, fullPath, zipPath);
    } else if (entry.isFile()) {
      zip.addFile(zipPath, fs.readFileSync(fullPath));
    }
  }
}

/**
 * Genera un archivo ZIP con la instantánea de la base de datos y todos los archivos de libros.
 * @param {string|null} destFilePath - Ruta opcional donde guardar el archivo .zip
 * @returns {Promise<{ filename: string, manifest: object, buffer: Buffer, filePath?: string }>}
 */
async function createBackupArchive(destFilePath = null) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const defaultFilename = `athenaeum-backup-${timestamp}.zip`;
  const targetFile = destFilePath || path.join(os.tmpdir(), defaultFilename);

  // 1. Crear instantánea consistente no bloqueante de SQLite
  const tempDbPath = path.join(os.tmpdir(), `temp-backup-db-${Date.now()}.sqlite`);
  try {
    await backupDatabase(tempDbPath);
  } catch (err) {
    throw new Error(`Error al generar la instantánea de la base de datos: ${err.message}`);
  }

  const zip = new AdmZip();

  // 2. Añadir la base de datos SQLite al paquete
  const dbBuffer = fs.readFileSync(tempDbPath);
  const dbChecksum = crypto.createHash('sha256').update(dbBuffer).digest('hex');
  zip.addFile('database.sqlite', dbBuffer);

  // Limpiar archivo temporal de base de datos
  try { fs.unlinkSync(tempDbPath); } catch (_) {}

  // 3. Añadir la carpeta de libros y assets
  if (fs.existsSync(BASE_LIBRARY_PATH)) {
    addDirectoryToZip(zip, BASE_LIBRARY_PATH, 'library');
  }

  // 4. Obtener estadísticas actuales
  const stats = getDatabaseStats();

  // 5. Generar manifiesto de la copia de seguridad
  const manifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app_version: APP_VERSION,
    created_at: new Date().toISOString(),
    database_checksum: `sha256:${dbChecksum}`,
    stats: {
      ...stats,
      total_db_size_bytes: dbBuffer.length
    },
    generator: 'MD Organizer Athenaeum'
  };

  zip.addFile('backup-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

  // 6. Escribir o exportar buffer
  const zipBuffer = zip.toBuffer();
  fs.writeFileSync(targetFile, zipBuffer);

  return {
    filename: defaultFilename,
    manifest,
    buffer: zipBuffer,
    filePath: targetFile,
    sizeBytes: zipBuffer.length
  };
}

/**
 * Inspecciona y valida un archivo de copia de seguridad sin modificar el sistema.
 * @param {string} zipFilePath
 * @returns {object} metadatos y estadísticas validadas
 */
function inspectBackupArchive(zipFilePath) {
  if (!fs.existsSync(zipFilePath)) {
    throw new Error('El archivo de copia de seguridad no existe.');
  }

  const zip = loadZipArchive(zipFilePath);
  const entries = zip.getEntries();

  if (!entries || entries.length === 0) {
    throw new Error('El archivo de copia de seguridad está vacío.');
  }

  // 1. Escaneo estricto de seguridad (Zip Slip, ZIP bomb, límites, extensiones)
  securityScanZip(zipFilePath, zip, entries);

  // 2. Localizar y validar el manifiesto
  const manifestEntry = entries.find(e => !e.isDirectory && /(^|\/)backup-manifest\.json$/i.test(e.entryName));
  if (!manifestEntry) {
    throw new Error('El archivo no es un backup válido de MD Organizer: falta "backup-manifest.json".');
  }

  let manifest;
  try {
    manifest = JSON.parse(zip.readAsText(manifestEntry));
  } catch (err) {
    throw new Error(`El manifiesto del backup está dañado o no es un JSON válido: ${err.message}`);
  }

  if (manifest.format !== BACKUP_FORMAT) {
    throw new Error(`Formato de copia desconocido: "${manifest.format}" (se esperaba "${BACKUP_FORMAT}").`);
  }

  // 3. Localizar y validar la base de datos
  const dbEntry = entries.find(e => !e.isDirectory && /(^|\/)database\.sqlite$/i.test(e.entryName));
  if (!dbEntry) {
    throw new Error('El archivo de copia de seguridad no contiene "database.sqlite".');
  }

  const dbData = dbEntry.getData();
  if (dbData.length < 16 || !dbData.subarray(0, 16).equals(SQLITE_HEADER)) {
    throw new Error('El archivo "database.sqlite" contenido en el backup no tiene una cabecera SQLite válida.');
  }

  // Comprobar checksum si está disponible
  if (manifest.database_checksum && manifest.database_checksum.startsWith('sha256:')) {
    const expected = manifest.database_checksum.slice(7);
    const actual = crypto.createHash('sha256').update(dbData).digest('hex');
    if (expected !== actual) {
      throw new Error(`Checksum de base de datos inválido (esperado: ${expected}, obtenido: ${actual}). El archivo puede estar corrupto.`);
    }
  }

  // Recuento de archivos en la carpeta library
  const libraryEntries = entries.filter(e => !e.isDirectory && /(^|\/)library\//i.test(e.entryName));

  return {
    valid: true,
    manifest,
    stats: manifest.stats || {},
    libraryFilesCount: libraryEntries.length,
    created_at: manifest.created_at,
    app_version: manifest.app_version,
    generator: manifest.generator
  };
}

/**
 * Restaura de forma atómica y segura una copia de seguridad con rollback automático.
 * @param {string} zipFilePath
 * @returns {Promise<{ success: boolean, manifest: object, message: string }>}
 */
async function restoreBackupArchive(zipFilePath) {
  // 1. Pre-flight check
  const inspection = inspectBackupArchive(zipFilePath);
  const zip = loadZipArchive(zipFilePath);
  const entries = zip.getEntries();

  const timestamp = Date.now();
  const rollbackDir = path.join(os.tmpdir(), `athenaeum-rollback-${timestamp}`);
  const stagingDir = path.join(os.tmpdir(), `athenaeum-restore-staging-${timestamp}`);

  ensureDir(rollbackDir);
  ensureDir(stagingDir);

  const stagingLibraryDir = path.join(stagingDir, 'library');
  const stagingDbPath = path.join(stagingDir, 'library.db');

  let rollbackDbPath = null;
  let rollbackLibraryPath = null;

  try {
    // 2. Crear punto de retorno automático del estado actual
    if (fs.existsSync(DB_PATH)) {
      rollbackDbPath = path.join(rollbackDir, 'library.db');
      fs.copyFileSync(DB_PATH, rollbackDbPath);
      // Copiar también archivos WAL y SHM si existen
      if (fs.existsSync(DB_PATH + '-wal')) fs.copyFileSync(DB_PATH + '-wal', rollbackDbPath + '-wal');
      if (fs.existsSync(DB_PATH + '-shm')) fs.copyFileSync(DB_PATH + '-shm', rollbackDbPath + '-shm');
    }

    if (fs.existsSync(BASE_LIBRARY_PATH)) {
      rollbackLibraryPath = path.join(rollbackDir, 'library');
      fs.cpSync(BASE_LIBRARY_PATH, rollbackLibraryPath, { recursive: true });
    }

    // 3. Extraer la base de datos restaurada en staging
    const dbEntry = entries.find(e => !e.isDirectory && /(^|\/)database\.sqlite$/i.test(e.entryName));
    fs.writeFileSync(stagingDbPath, dbEntry.getData());

    // 4. Verificar integridad de la base de datos extraída
    try {
      const testDb = new Database(stagingDbPath);
      const integrity = testDb.pragma('integrity_check');
      testDb.close();
      if (!integrity || !integrity[0] || integrity[0].integrity_check !== 'ok') {
        throw new Error('La verificación de integridad SQLite falló.');
      }
    } catch (testErr) {
      throw new Error(`La base de datos del backup está dañada: ${testErr.message}`);
    }

    // 5. Extraer archivos de la biblioteca en staging con protección Zip Slip
    ensureDir(stagingLibraryDir);
    const libraryEntries = entries.filter(e => !e.isDirectory && /(^|\/)library\//i.test(e.entryName));

    for (const entry of libraryEntries) {
      const relativeToLibrary = entry.entryName.replace(/^.*library[\\/]/i, '');
      if (!relativeToLibrary) continue;

      const safeDest = safeResolvePath(relativeToLibrary, stagingLibraryDir);
      ensureDir(path.dirname(safeDest));
      fs.writeFileSync(safeDest, entry.getData());
    }

    // 6. Cerrar conexión actual de la base de datos
    closeDatabase();

    // 7. Sustituir físicamente la base de datos
    ensureDir(path.dirname(DB_PATH));
    // Eliminar posibles restos de WAL/SHM antiguos
    try { if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal'); } catch (_) {}
    try { if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm'); } catch (_) {}
    fs.copyFileSync(stagingDbPath, DB_PATH);

    // 8. Sustituir físicamente la carpeta library
    ensureDir(BASE_LIBRARY_PATH);
    if (fs.existsSync(BASE_LIBRARY_PATH)) {
      fs.rmSync(BASE_LIBRARY_PATH, { recursive: true, force: true });
    }
    ensureDir(BASE_LIBRARY_PATH);
    if (fs.existsSync(stagingLibraryDir)) {
      fs.cpSync(stagingLibraryDir, BASE_LIBRARY_PATH, { recursive: true });
    }

    // 9. Reabrir conexión de SQLite y re-mapear rutas
    reopenDatabase();
    remapStoragePaths(BASE_LIBRARY_PATH);

    // 10. Limpieza de directorios temporales de staging y rollback
    try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(rollbackDir, { recursive: true, force: true }); } catch (_) {}

    return {
      success: true,
      manifest: inspection.manifest,
      message: `Copia de seguridad restaurada con éxito. Se recuperaron ${inspection.stats.booksCount || 0} libros y ${inspection.stats.chaptersCount || 0} capítulos.`
    };
  } catch (err) {
    // ─── ROLLBACK AUTOMÁTICO EN CASO DE FALLO ───
    console.error('Error durante la restauración, ejecutando rollback automático:', err);

    try {
      closeDatabase();

      if (rollbackDbPath && fs.existsSync(rollbackDbPath)) {
        fs.copyFileSync(rollbackDbPath, DB_PATH);
        if (fs.existsSync(rollbackDbPath + '-wal')) fs.copyFileSync(rollbackDbPath + '-wal', DB_PATH + '-wal');
        if (fs.existsSync(rollbackDbPath + '-shm')) fs.copyFileSync(rollbackDbPath + '-shm', DB_PATH + '-shm');
      }

      if (rollbackLibraryPath && fs.existsSync(rollbackLibraryPath)) {
        if (fs.existsSync(BASE_LIBRARY_PATH)) fs.rmSync(BASE_LIBRARY_PATH, { recursive: true, force: true });
        ensureDir(BASE_LIBRARY_PATH);
        fs.cpSync(rollbackLibraryPath, BASE_LIBRARY_PATH, { recursive: true });
      }

      reopenDatabase();
      remapStoragePaths(BASE_LIBRARY_PATH);
    } catch (rbErr) {
      console.error('Error crítico al ejecutar rollback:', rbErr);
    } finally {
      try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch (_) {}
      try { fs.rmSync(rollbackDir, { recursive: true, force: true }); } catch (_) {}
    }

    throw new Error(`Restauración abortada. Se ha revertido al estado anterior de forma segura. Motivo: ${err.message}`);
  }
}

module.exports = {
  createBackupArchive,
  inspectBackupArchive,
  restoreBackupArchive,
  BACKUP_FORMAT,
  BACKUP_VERSION
};
