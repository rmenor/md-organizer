const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  getLibraryTree,
  getBookById,
  getChapterContent,
  deleteBook,
  searchLibrary,
  verifyBookIntegrity,
  verifyLibraryIntegrity
} = require('./src/db');
const { processZipFile } = require('./src/processor');
const {
  createBackupArchive,
  inspectBackupArchive,
  restoreBackupArchive
} = require('./src/backup');

const app = express();
const PORT = process.env.PORT || 3000;
const wikiPath = path.join(__dirname, 'WIKI_COMO_HACER_LIBROS.md');

// Configurar directorio temporal de uploads
const uploadsDir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Inicialización automática de ejemplos si la biblioteca está vacía (ideal para Serverless / Vercel)
async function ensureInitialData() {
  try {
    const tree = getLibraryTree();
    let count = 0;
    tree.forEach(sec => sec.subsections.forEach(sub => { count += (sub.books || []).length; }));
    if (count === 0) {
      const sample1 = path.join(__dirname, 'examples', '1_libro_codigo_limpio_v1.zip');
      const sample2 = path.join(__dirname, 'examples', '4_sqlite_guia_auto.zip');
      const sample3 = path.join(__dirname, 'examples', '5_especificacion_mdz_book.mdz');
      if (fs.existsSync(sample1)) await processZipFile(sample1, '1_libro_codigo_limpio_v1.zip');
      if (fs.existsSync(sample2)) await processZipFile(sample2, '4_sqlite_guia_auto.zip');
      if (fs.existsSync(sample3)) await processZipFile(sample3, '5_especificacion_mdz_book.mdz');
    }
  } catch (_) {}
}
ensureInitialData();

// Configurar multer para archivos ZIP
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeOriginalName = path.basename(file.originalname || 'upload.zip').replace(/[\\/\0]/g, '_');
    cb(null, uniqueSuffix + '-' + safeOriginalName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Límite 50MB
  fileFilter: (req, file, cb) => {
    const originalLower = (file.originalname || '').toLowerCase();
    const isZipOrMdz = originalLower.endsWith('.zip') || originalLower.endsWith('.mdz');
    const isZipMime = file.mimetype === 'application/zip' || 
                      file.mimetype === 'application/x-zip-compressed' || 
                      file.mimetype === 'application/octet-stream' ||
                      file.mimetype === 'application/x-zip';

    if (isZipOrMdz || isZipMime) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos comprimidos en formato .zip o .mdz'));
    }
  }
});

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/examples', express.static(path.join(__dirname, 'examples')));

// Endpoint: Servir la guía mantenida de creación de libros
app.get('/api/wiki', (req, res) => {
  fs.readFile(wikiPath, 'utf8', (err, content) => {
    if (err) {
      return res.status(500).json({ error: 'Wiki content unavailable' });
    }

    res.json({
      content,
      source: 'WIKI_COMO_HACER_LIBROS.md'
    });
  });
});

// Servir assets de los libros (portadas, diagramas, imágenes)
app.get('/api/books/:id/assets/:assetName', (req, res) => {
  try {
    const book = getBookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Libro no encontrado' });

    // Sanitizar nombre del asset para evitar traversal
    const safeAssetName = path.basename(req.params.assetName);
    if (safeAssetName !== req.params.assetName || /[\\/\0]/.test(req.params.assetName)) {
      return res.status(400).json({ error: 'Nombre de asset no válido' });
    }
    const assetPath = path.join(book.storage_path, 'assets', safeAssetName);

    if (!fs.existsSync(assetPath)) {
      return res.status(404).json({ error: 'Asset no encontrado' });
    }

    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(assetPath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Obtener árbol completo de la biblioteca (Secciones > Subsecciones > Libros)
app.get('/api/tree', (req, res) => {
  try {
    const tree = getLibraryTree();
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Buscar libros
app.get('/api/search', (req, res) => {
  try {
    const query = req.query.q || '';
    if (!query.trim()) {
      return res.json([]);
    }
    const results = searchLibrary(query);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Obtener detalle de un libro y sus capítulos
app.get('/api/books/:id', (req, res) => {
  try {
    const book = getBookById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Obtener contenido Markdown de un capítulo
app.get('/api/books/:bookId/chapters/:chapterId', (req, res) => {
  try {
    const data = getChapterContent(req.params.bookId, req.params.chapterId);
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Endpoint: Verificar integridad criptográfica SHA-256 de un libro y sus capítulos
app.get('/api/books/:id/integrity', (req, res) => {
  try {
    const report = verifyBookIntegrity(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Auditoría de integridad global de toda la biblioteca
app.get('/api/integrity', (req, res) => {
  try {
    const report = verifyLibraryIntegrity();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Endpoint: Subir y procesar un archivo ZIP o MDZ
const uploadFields = upload.fields([
  { name: 'zipFile', maxCount: 1 },
  { name: 'zipfile', maxCount: 1 },
  { name: 'file', maxCount: 1 },
  { name: 'package', maxCount: 1 }
]);

app.post('/api/upload', (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    const uploadedFile = (req.files && (
      req.files['zipFile']?.[0] ||
      req.files['zipfile']?.[0] ||
      req.files['file']?.[0] ||
      req.files['package']?.[0]
    )) || req.file;

    req.file = uploadedFile;
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha adjuntado ningún archivo (.zip o .mdz).' });
  }

  const uploadedFilePath = req.file.path;
  const originalName = req.file.originalname;

  try {
    const book = await processZipFile(uploadedFilePath, originalName);

    // Limpiar archivo temporal
    if (fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }

    const message = book.replaced
      ? `El libro "${book.title}" (Código: ${book.code}) ha sido actualizado con éxito a la versión v${book.version} (fecha: ${book.publication_date}). Se sustituyó la versión anterior v${book.previousVersion}.`
      : `El libro "${book.title}" (Código: ${book.code}, v${book.version}) ha sido organizado exitosamente.`;

    res.status(book.replaced ? 200 : 201).json({
      success: true,
      replaced: book.replaced,
      message,
      book
    });
  } catch (err) {
    // Asegurar limpieza en caso de error
    if (fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch (_) {}
    }

    if (err.isVersionConflict) {
      return res.status(409).json({
        error: err.message,
        isVersionConflict: true,
        existingBook: err.existingBook
      });
    }

    if (err.isSecurityError) {
      return res.status(400).json({ error: 'El archivo fue rechazado por motivos de seguridad.' });
    }

    if (err.isValidationError) {
      return res.status(422).json({
        error: err.message,
        isValidationError: true,
        validationErrors: err.validationErrors
      });
    }

    console.error('Error al procesar paquete comprimido:', err);
    res.status(400).json({ error: err.message || 'Error al procesar el archivo (.zip o .mdz).' });

  }
});

// ==========================================
// ENDPOINTS DE COPIAS DE SEGURIDAD (BACKUP & RESTORE)
// ==========================================

// Endpoint: Exportar y descargar copia de seguridad completa (.zip)
app.get('/api/backup/export', async (req, res) => {
  try {
    const backup = await createBackupArchive();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
    res.setHeader('Content-Length', backup.sizeBytes);
    res.send(backup.buffer);

    // Limpiar archivo temporal en disco si se guardó
    if (backup.filePath && fs.existsSync(backup.filePath)) {
      try { fs.unlinkSync(backup.filePath); } catch (_) {}
    }
  } catch (err) {
    console.error('Error al generar copia de seguridad:', err);
    res.status(500).json({ error: `Error al generar la copia de seguridad: ${err.message}` });
  }
});

// Endpoint: Inspeccionar y validar archivo de copia de seguridad (pre-flight)
app.post('/api/backup/inspect', (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const uploadedFile = (req.files && (
      req.files['backupFile']?.[0] ||
      req.files['backup']?.[0] ||
      req.files['file']?.[0] ||
      req.files['zipFile']?.[0]
    )) || req.file;

    req.file = uploadedFile;
    next();
  });
}, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha adjuntado ningún archivo de copia de seguridad.' });
  }

  const uploadedFilePath = req.file.path;
  try {
    const inspection = inspectBackupArchive(uploadedFilePath);
    if (fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch (_) {}
    }
    res.json(inspection);
  } catch (err) {
    if (fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch (_) {}
    }
    res.status(400).json({ error: err.message });
  }
});

// Endpoint: Restaurar copia de seguridad con rollback automático
app.post('/api/backup/restore', (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const uploadedFile = (req.files && (
      req.files['backupFile']?.[0] ||
      req.files['backup']?.[0] ||
      req.files['file']?.[0] ||
      req.files['zipFile']?.[0]
    )) || req.file;

    req.file = uploadedFile;
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha adjuntado ningún archivo de copia de seguridad para restaurar.' });
  }

  const uploadedFilePath = req.file.path;
  try {
    const result = await restoreBackupArchive(uploadedFilePath);
    if (fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch (_) {}
    }
    res.json(result);
  } catch (err) {
    if (fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch (_) {}
    }
    console.error('Error al restaurar copia de seguridad:', err);
    res.status(400).json({ error: err.message });
  }
});


// Endpoint: Eliminar libro
app.delete('/api/books/:id', (req, res) => {
  try {
    const book = deleteBook(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    // Eliminar carpeta del libro en disco si existe
    if (book.storage_path && fs.existsSync(book.storage_path)) {
      fs.rmSync(book.storage_path, { recursive: true, force: true });
    }

    res.json({ success: true, message: 'Libro eliminado con éxito.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Iniciar servidor solo si no está siendo requerido por tests
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`📚 Servidor de Biblioteca Markdown activo en http://localhost:${PORT}`);
  });
}

module.exports = app;
