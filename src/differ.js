/**
 * src/differ.js
 * Motor de comparación y diffing entre dos versiones de un libro (capítulos, contenidos y assets).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { diffSemVer, compareSemVer } = require('./semver');

/**
 * Calcula el hash SHA-256 de un buffer o string.
 */
function computeSha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Cuenta palabras en un texto de manera consistente.
 */
function countWords(str) {
  if (!str) return 0;
  const matches = str.trim().match(/[\w\u00C0-\u024F\u1E00-\u1EFF]+/g);
  return matches ? matches.length : 0;
}

/**
 * Algoritmo LCS (Longest Common Subsequence) para diff textual por líneas.
 * @param {string} textA
 * @param {string} textB
 * @returns {Array<{ type: 'added' | 'removed' | 'unchanged', text: string, lineA?: number, lineB?: number }>}
 */
function computeLineDiff(textA, textB) {
  const linesA = String(textA || '').split('\n');
  const linesB = String(textB || '').split('\n');

  const n = linesA.length;
  const m = linesB.length;

  // Si ambos son idénticos o uno de ellos está vacío
  if (textA === textB) {
    return linesA.map((line, idx) => ({
      type: 'unchanged',
      text: line,
      lineA: idx + 1,
      lineB: idx + 1
    }));
  }

  // Matriz DP para LCS
  // Para textos muy grandes limitamos para evitar OOM
  if (n * m > 1000000) {
    // Diff simplificado para archivos gigantes
    return [
      { type: 'removed', text: `[Texto anterior: ${n} líneas, ${countWords(textA)} palabras]` },
      { type: 'added', text: `[Texto nuevo: ${m} líneas, ${countWords(textB)} palabras]` }
    ];
  }

  const matrix = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  // Reconstrucción del diff
  let i = n;
  let j = m;
  const diff = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      diff.unshift({
        type: 'unchanged',
        text: linesA[i - 1],
        lineA: i,
        lineB: j
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      diff.unshift({
        type: 'added',
        text: linesB[j - 1],
        lineB: j
      });
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      diff.unshift({
        type: 'removed',
        text: linesA[i - 1],
        lineA: i
      });
      i--;
    }
  }

  return diff;
}

/**
 * Lee los assets presentes en el directorio de una versión.
 * @param {string} storagePath
 * @returns {Map<string, { filename: string, relativePath: string, sizeBytes: number, checksum: string }>}
 */
function readVersionAssets(storagePath) {
  const assetsMap = new Map();
  if (!storagePath || !fs.existsSync(storagePath)) return assetsMap;

  const assetsDir = path.join(storagePath, 'assets');
  if (!fs.existsSync(assetsDir)) return assetsMap;

  try {
    const files = fs.readdirSync(assetsDir, { withFileTypes: true });
    for (const f of files) {
      if (f.isFile()) {
        const fullPath = path.join(assetsDir, f.name);
        const buffer = fs.readFileSync(fullPath);
        assetsMap.set(f.name.toLowerCase(), {
          filename: f.name,
          relativePath: path.join('assets', f.name),
          sizeBytes: buffer.length,
          checksum: computeSha256(buffer)
        });
      }
    }
  } catch (_) {}

  return assetsMap;
}

/**
 * Compara dos versiones de un libro produciendo un reporte estructurado y completo.
 * @param {object} versionA - Versión origen (base)
 * @param {object} versionB - Versión destino (nueva)
 * @param {object} [options]
 * @param {boolean} [options.includeLineDiff=true] - Incluir diff por líneas en capítulos modificados
 * @returns {object} Reporte de diferencias
 */
function compareBookVersions(versionA, versionB, options = {}) {
  if (!versionA || !versionB) {
    throw new Error('Se requieren ambas versiones para realizar la comparación.');
  }

  const includeLineDiff = options.includeLineDiff !== false;

  const semverJump = diffSemVer(versionA.version, versionB.version);
  const isDirectOrder = compareSemVer(versionA.version, versionB.version) <= 0;

  // 1. Obtener listas de capítulos de ambas versiones
  let chaptersA = Array.isArray(versionA.chapters) ? versionA.chapters : [];
  let chaptersB = Array.isArray(versionB.chapters) ? versionB.chapters : [];

  // Parsear manifest si viene en formato JSON string
  if (typeof versionA.chapters_manifest === 'string' && versionA.chapters_manifest && chaptersA.length === 0) {
    try { chaptersA = JSON.parse(versionA.chapters_manifest); } catch (_) {}
  }
  if (typeof versionB.chapters_manifest === 'string' && versionB.chapters_manifest && chaptersB.length === 0) {
    try { chaptersB = JSON.parse(versionB.chapters_manifest); } catch (_) {}
  }

  // 2. Comparación de Capítulos
  const chaptersReport = [];
  const mapB = new Map();

  chaptersB.forEach(ch => {
    const key = (ch.relative_path || ch.file_name || String(ch.order_index || '')).toLowerCase();
    mapB.set(key, ch);
  });

  const visitedBKeys = new Set();
  let totalWordsA = 0;
  let totalWordsB = 0;

  let countAdded = 0;
  let countRemoved = 0;
  let countModified = 0;
  let countUnchanged = 0;

  // Procesar capítulos de versión A
  for (const chA of chaptersA) {
    const wordsA = chA.word_count || 0;
    totalWordsA += wordsA;

    const keyA = (chA.relative_path || chA.file_name || String(chA.order_index || '')).toLowerCase();
    const chB = mapB.get(keyA);

    if (!chB) {
      // Capítulo Eliminado en versión B
      countRemoved++;
      chaptersReport.push({
        status: 'removed',
        title: chA.title,
        order_index: chA.order_index,
        chapter_number: chA.order_index,
        file_name: chA.file_name,
        relative_path: chA.relative_path,
        checksumA: chA.checksum || '',
        checksumB: null,
        wordsA,
        wordsB: 0,
        wordDelta: -wordsA,
        diff: []
      });
    } else {
      visitedBKeys.add(keyA);
      const wordsB = chB.word_count || 0;
      totalWordsB += wordsB;

      const checksumA = chA.checksum || '';
      const checksumB = chB.checksum || '';
      const isSameChecksum = checksumA && checksumB && checksumA === checksumB;

      if (isSameChecksum) {
        // Capítulo Sin Cambios
        countUnchanged++;
        chaptersReport.push({
          status: 'unchanged',
          title: chB.title || chA.title,
          order_index: chB.order_index,
          chapter_number: chB.order_index,
          file_name: chB.file_name,
          relative_path: chB.relative_path,
          checksumA,
          checksumB,
          wordsA,
          wordsB,
          wordDelta: 0,
          diff: []
        });
      } else {
        // Capítulo Modificado
        countModified++;
        let lineDiff = [];
        if (includeLineDiff) {
          const pathA = versionA.storage_path ? path.join(versionA.storage_path, chA.relative_path) : null;
          const pathB = versionB.storage_path ? path.join(versionB.storage_path, chB.relative_path) : null;

          const textA = (pathA && fs.existsSync(pathA)) ? fs.readFileSync(pathA, 'utf8') : '';
          const textB = (pathB && fs.existsSync(pathB)) ? fs.readFileSync(pathB, 'utf8') : '';

          lineDiff = computeLineDiff(textA, textB);
        }

        chaptersReport.push({
          status: 'modified',
          title: chB.title || chA.title,
          titleA: chA.title,
          titleB: chB.title,
          titleChanged: chA.title !== chB.title,
          order_index: chB.order_index,
          chapter_number: chB.order_index,
          file_name: chB.file_name,
          relative_path: chB.relative_path,
          checksumA,
          checksumB,
          wordsA,
          wordsB,
          wordDelta: wordsB - wordsA,
          diff: lineDiff
        });
      }
    }
  }

  // Procesar capítulos de versión B que no estaban en A (Añadidos)
  for (const chB of chaptersB) {
    const keyB = (chB.relative_path || chB.file_name || String(chB.order_index || '')).toLowerCase();
    if (!visitedBKeys.has(keyB)) {
      const wordsB = chB.word_count || 0;
      totalWordsB += wordsB;
      countAdded++;

      chaptersReport.push({
        status: 'added',
        title: chB.title,
        order_index: chB.order_index,
        chapter_number: chB.order_index,
        file_name: chB.file_name,
        relative_path: chB.relative_path,
        checksumA: null,
        checksumB: chB.checksum || '',
        wordsA: 0,
        wordsB,
        wordDelta: wordsB,
        diff: []
      });
    }
  }

  // Ordenar reporte de capítulos por número de capítulo
  chaptersReport.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  // 3. Comparación de Recursos / Assets
  const assetsA = readVersionAssets(versionA.storage_path);
  const assetsB = readVersionAssets(versionB.storage_path);
  const assetsReport = [];

  for (const [key, assetA] of assetsA.entries()) {
    const assetB = assetsB.get(key);
    if (!assetB) {
      assetsReport.push({
        status: 'removed',
        filename: assetA.filename,
        relativePath: assetA.relativePath,
        sizeA: assetA.sizeBytes,
        sizeB: 0,
        checksumA: assetA.checksum,
        checksumB: null
      });
    } else if (assetA.checksum === assetB.checksum) {
      assetsReport.push({
        status: 'unchanged',
        filename: assetB.filename,
        relativePath: assetB.relativePath,
        sizeA: assetA.sizeBytes,
        sizeB: assetB.sizeBytes,
        checksumA: assetA.checksum,
        checksumB: assetB.checksum
      });
    } else {
      assetsReport.push({
        status: 'modified',
        filename: assetB.filename,
        relativePath: assetB.relativePath,
        sizeA: assetA.sizeBytes,
        sizeB: assetB.sizeBytes,
        checksumA: assetA.checksum,
        checksumB: assetB.checksum
      });
    }
  }

  for (const [key, assetB] of assetsB.entries()) {
    if (!assetsA.has(key)) {
      assetsReport.push({
        status: 'added',
        filename: assetB.filename,
        relativePath: assetB.relativePath,
        sizeA: 0,
        sizeB: assetB.sizeBytes,
        checksumA: null,
        checksumB: assetB.checksum
      });
    }
  }

  return {
    book: {
      code: versionB.code || versionA.code,
      title: versionB.title || versionA.title
    },
    versionA: {
      id: versionA.id,
      version: versionA.version,
      publication_date: versionA.publication_date,
      state: versionA.state || 'published',
      checksum: versionA.checksum,
      changelog: versionA.changelog || ''
    },
    versionB: {
      id: versionB.id,
      version: versionB.version,
      publication_date: versionB.publication_date,
      state: versionB.state || 'published',
      checksum: versionB.checksum,
      changelog: versionB.changelog || ''
    },
    comparison: {
      semverJump,
      isDirectOrder,
      hasChanges: countAdded > 0 || countRemoved > 0 || countModified > 0 || assetsReport.some(a => a.status !== 'unchanged'),
      summary: {
        chapters: {
          totalA: chaptersA.length,
          totalB: chaptersB.length,
          added: countAdded,
          removed: countRemoved,
          modified: countModified,
          unchanged: countUnchanged
        },
        words: {
          totalA: totalWordsA,
          totalB: totalWordsB,
          netDelta: totalWordsB - totalWordsA
        },
        assets: {
          totalA: assetsA.size,
          totalB: assetsB.size,
          added: assetsReport.filter(a => a.status === 'added').length,
          removed: assetsReport.filter(a => a.status === 'removed').length,
          modified: assetsReport.filter(a => a.status === 'modified').length,
          unchanged: assetsReport.filter(a => a.status === 'unchanged').length
        }
      }
    },
    chapters: chaptersReport,
    assets: assetsReport,
    comparedAt: new Date().toISOString()
  };
}

module.exports = {
  computeLineDiff,
  readVersionAssets,
  compareBookVersions
};
