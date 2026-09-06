/**
 * src/semver.js
 * Motor de Semantic Versioning (SemVer 2.0.0) estricto y utilidades de comparación.
 */

// Expresión regular SemVer 2.0.0 oficial
const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Normaliza una cadena de versión flexible a un formato SemVer 2.0.0 estándar.
 * Ejemplos:
 *  - "v1.2.3" -> "1.2.3"
 *  - "1.0"    -> "1.0.0"
 *  - "2"      -> "2.0.0"
 *  - "v2.0-beta.1" -> "2.0.0-beta.1"
 * @param {string|number} rawVersion
 * @returns {string} Versión normalizada o fallback "1.0.0"
 */
function normalizeSemVer(rawVersion) {
  if (rawVersion === null || rawVersion === undefined) return '1.0.0';
  let str = String(rawVersion).trim();
  
  // Quitar prefijo 'v' o 'V'
  if (/^v/i.test(str)) {
    str = str.slice(1).trim();
  }

  // Separar metadata de build (+) y prerelease (-)
  let build = '';
  const buildIndex = str.indexOf('+');
  if (buildIndex !== -1) {
    build = str.slice(buildIndex);
    str = str.slice(0, buildIndex);
  }

  let prerelease = '';
  const preIndex = str.indexOf('-');
  if (preIndex !== -1) {
    prerelease = str.slice(preIndex);
    str = str.slice(0, preIndex);
  }

  // Normalizar los componentes numéricos principales
  const parts = str.split('.').map(p => p.trim()).filter(Boolean);
  let major = 1;
  let minor = 0;
  let patch = 0;

  if (parts.length >= 1) {
    const parsedMajor = parseInt(parts[0], 10);
    if (!isNaN(parsedMajor) && parsedMajor >= 0) major = parsedMajor;
  }
  if (parts.length >= 2) {
    const parsedMinor = parseInt(parts[1], 10);
    if (!isNaN(parsedMinor) && parsedMinor >= 0) minor = parsedMinor;
  }
  if (parts.length >= 3) {
    const parsedPatch = parseInt(parts[2], 10);
    if (!isNaN(parsedPatch) && parsedPatch >= 0) patch = parsedPatch;
  }

  const normalized = `${major}.${minor}.${patch}${prerelease}${build}`;
  return isValidSemVer(normalized) ? normalized : `${major}.${minor}.${patch}`;
}

/**
 * Comprueba si una cadena cumple estrictamente con la especificación SemVer 2.0.0.
 * @param {string} versionStr
 * @returns {boolean}
 */
function isValidSemVer(versionStr) {
  if (typeof versionStr !== 'string') return false;
  return SEMVER_REGEX.test(versionStr.trim());
}

/**
 * Parsea una versión SemVer en sus componentes estructurados.
 * @param {string} versionStr
 * @returns {{ major: number, minor: number, patch: number, prerelease: string[], build: string, raw: string } | null}
 */
function parseSemVer(versionStr) {
  const normalized = normalizeSemVer(versionStr);
  const match = normalized.match(SEMVER_REGEX);
  if (!match) return null;

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);
  const prerelease = match[4] ? match[4].split('.') : [];
  const build = match[5] || '';

  return {
    major,
    minor,
    patch,
    prerelease,
    build,
    raw: normalized
  };
}

/**
 * Compara dos identificadores de pre-lanzamiento según la regla 11 de SemVer 2.0.0.
 * @param {string} a
 * @param {string} b
 * @returns {number} -1 si a < b, 1 si a > b, 0 si son iguales
 */
function comparePrereleaseIdentifier(a, b) {
  const isNumA = /^\d+$/.test(a);
  const isNumB = /^\d+$/.test(b);

  if (isNumA && isNumB) {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (numA < numB) return -1;
    if (numA > numB) return 1;
    return 0;
  }

  if (isNumA && !isNumB) return -1; // Los numéricos tienen menor precedencia que los alfanuméricos
  if (!isNumA && isNumB) return 1;

  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Compara dos versiones SemVer 2.0.0.
 * @param {string} v1
 * @param {string} v2
 * @returns {number} 1 si v1 > v2, -1 si v1 < v2, 0 si v1 == v2
 */
function compareSemVer(v1, v2) {
  const sem1 = parseSemVer(v1);
  const sem2 = parseSemVer(v2);

  if (!sem1 && !sem2) return 0;
  if (!sem1) return -1;
  if (!sem2) return 1;

  // Comparar Major
  if (sem1.major > sem2.major) return 1;
  if (sem1.major < sem2.major) return -1;

  // Comparar Minor
  if (sem1.minor > sem2.minor) return 1;
  if (sem1.minor < sem2.minor) return -1;

  // Comparar Patch
  if (sem1.patch > sem2.patch) return 1;
  if (sem1.patch < sem2.patch) return -1;

  // Comparar Pre-release
  // Cuando major, minor y patch son iguales, una versión con prerelease tiene MENOR precedencia que una normal.
  const hasPre1 = sem1.prerelease.length > 0;
  const hasPre2 = sem2.prerelease.length > 0;

  if (!hasPre1 && hasPre2) return 1;  // 1.0.0 > 1.0.0-alpha
  if (hasPre1 && !hasPre2) return -1; // 1.0.0-alpha < 1.0.0

  if (hasPre1 && hasPre2) {
    const len = Math.max(sem1.prerelease.length, sem2.prerelease.length);
    for (let i = 0; i < len; i++) {
      const part1 = sem1.prerelease[i];
      const part2 = sem2.prerelease[i];

      if (part1 === undefined) return -1; // Un conjunto menor tiene menor precedencia
      if (part2 === undefined) return 1;

      const comp = comparePrereleaseIdentifier(part1, part2);
      if (comp !== 0) return comp;
    }
  }

  // Build metadata se ignora en la precedencia según SemVer 2.0.0
  return 0;
}

/**
 * Determina el tipo de salto de versión entre v1 (base) y v2 (nueva).
 * @param {string} v1
 * @param {string} v2
 * @returns {'major' | 'minor' | 'patch' | 'prerelease' | 'equal' | 'downgrade'}
 */
function diffSemVer(v1, v2) {
  const sem1 = parseSemVer(v1);
  const sem2 = parseSemVer(v2);

  if (!sem1 || !sem2) return 'equal';

  const comp = compareSemVer(v1, v2);
  if (comp < 0) {
    if (sem2.major > sem1.major) return 'major';
    if (sem2.minor > sem1.minor) return 'minor';
    if (sem2.patch > sem1.patch) return 'patch';
    return 'prerelease';
  } else if (comp > 0) {
    return 'downgrade';
  }
  return 'equal';
}

module.exports = {
  SEMVER_REGEX,
  normalizeSemVer,
  isValidSemVer,
  parseSemVer,
  compareSemVer,
  diffSemVer
};
