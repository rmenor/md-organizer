const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const examplesDir = path.join(__dirname);
if (!fs.existsSync(examplesDir)) {
  fs.mkdirSync(examplesDir, { recursive: true });
}

// Helper para crear ZIP de prueba de Código Limpio con código, versión y fecha
function createVersionedBookZip(fileName, code, version, date, chapterNotes = '') {
  const zip = new AdmZip();

  const metadata = {
    code: code,
    version: version,
    date: date,
    publication_date: date,
    title: "El Arte del Código Limpio",
    author: "Ada Lovelace & Martin Fowler",
    description: `Edición ${version} (${date}). Una guía práctica para diseñar software legible y desacoplado. ${chapterNotes}`,
    section: "Ingeniería de Software",
    subsection: "Buenas Prácticas",
    language: "es",
    cover: "assets/cover.png",
    chapters: [
      {
        title: `Capítulo 1: Nombres con Significado (v${version})`,
        file: "01_nombres_con_significado.md"
      },
      {
        title: `Capítulo 2: Funciones Pequeñas y Enfocadas (v${version})`,
        file: "02_funciones_pequenas.md"
      }
    ]
  };

  const cap1 = `# Capítulo 1: Nombres con Significado (Versión ${version})

> Fecha de esta edición: **${date}** | Código: **${code}**

El nombre de una variable, función o clase debe responder a las grandes preguntas: **por qué existe**, **qué hace** y **cómo se usa**.

\`\`\`javascript
const VERSION = "${version}";
const RELEASE_DATE = "${date}";
console.log("Cargando libro:", "${code}", VERSION);
\`\`\`
`;

  const cap2 = `# Capítulo 2: Funciones Pequeñas (Versión ${version})

Las funciones deben hacer una sola cosa, y hacerla bien.
`;

  const dummyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const coverBuffer = Buffer.from(dummyPngBase64, 'base64');

  zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'));
  zip.addFile('01_nombres_con_significado.md', Buffer.from(cap1, 'utf8'));
  zip.addFile('02_funciones_pequenas.md', Buffer.from(cap2, 'utf8'));
  zip.addFile('assets/cover.png', coverBuffer);

  const destZip = path.join(examplesDir, fileName);
  zip.writeZip(destZip);
  console.log(`✅ Creado: ${fileName} [Código: ${code}, v${version}, Fecha: ${date}]`);
  return destZip;
}

// 1. Libro Base (v1.0.0, fecha 2024-01-15)
createVersionedBookZip('1_libro_codigo_limpio_v1.zip', 'BK-CLEAN-CODE', '1.0.0', '2024-01-15');

// 2. Libro Antiguo (v0.9.0, fecha 2023-10-01) -> Para probar que avisa que ya existe una versión superior
createVersionedBookZip('2_libro_antiguo_v0.9_rechazado.zip', 'BK-CLEAN-CODE', '0.9.0', '2023-10-01', '[Versión obsoleta]');

// 3. Libro Nuevo (v2.0.0, fecha 2025-06-01) -> Para probar que sustituye correctamente
createVersionedBookZip('3_libro_nuevo_v2_actualizado.zip', 'BK-CLEAN-CODE', '2.0.0', '2025-06-01', '[Versión actualizada]');

// 4. Libro con inferencia automática (sin JSON)
function createAutoBook() {
  const zip = new AdmZip();
  const doc1 = `---
title: Introducción a SQLite y Sistemas Embebidos
author: Richard Hipp
code: BK-SQLITE-EMB
version: 1.2.0
date: 2024-08-20
---

# Introducción a SQLite y Sistemas Embebidos

SQLite es autónomo, sin servidor y de cero configuración.
`;
  zip.addFile('Bases_de_Datos/SQLite/01_introduccion.md', Buffer.from(doc1, 'utf8'));
  const destZip = path.join(examplesDir, '4_sqlite_guia_auto.zip');
  zip.writeZip(destZip);
  console.log(`✅ Creado: 4_sqlite_guia_auto.zip [Inferencia automática con frontmatter]`);
}

createAutoBook();

// 5. Libro con especificación MDZ (Book Profile con manifest.json, metadata/book.json, chapters/, assets/)
function createMdzBook() {
  const zip = new AdmZip();

  const manifest = {
    format: "mdz",
    version: "1.0",
    profile: "book",
    metadata: "metadata/book.json",
    assets: "assets/"
  };

  const bookMeta = {
    code: "BK-MDZ-SPEC",
    title: "Especificación MDZ y Perfil de Libros",
    author: "Markdown Packaging Working Group",
    version: "1.0.0",
    date: "2026-09-06",
    publication_date: "2026-09-06",
    description: "Especificación abierta de empaquetado y distribución portable de publicaciones Markdown versionadas (MDZ Book Profile).",
    section: "Arquitectura",
    subsection: "Estándares Web",
    language: "es",
    cover: "assets/cover.png",
    chapters: [
      {
        title: "1. Manifiesto y Filosofía MDZ",
        file: "chapters/01_manifiesto_y_filosofia.md"
      },
      {
        title: "2. Perfil de Libros y Capítulos",
        file: "chapters/02_perfil_de_libros.md"
      },
      {
        title: "3. Interoperabilidad con Editores y CI/CD",
        file: "chapters/03_interoperabilidad.md"
      }
    ]
  };

  const cap1 = `# 1. Manifiesto y Filosofía MDZ

MDZ (*Markdown Zip*) es un estándar abierto para empaquetar conjuntos de documentos Markdown, metadatos estructurados y recursos binarios en un único archivo comprimido universal.

## ¿Por qué MDZ?

* **Portabilidad total**: No depende de bases de datos cerradas ni servidores propietarios.
* **Inspeccionable**: Cualquier herramienta que soporte archivos ZIP puede leer e inspeccionar el contenido.
* **Compatible con Git y CI/CD**: Fácil de generar mediante flujos automatizados de GitHub Actions o scripts.
`;

  const cap2 = `# 2. Perfil de Libros y Capítulos

El **Book Profile** define una estructura canónica para libros técnicos, manuales y colecciones de lectura:

\`\`\`text
Book Package (.mdz)
├── manifest.json
├── metadata/
│   └── book.json
├── chapters/
│   ├── 01_intro.md
│   └── 02_setup.md
└── assets/
    └── cover.png
\`\`\`
`;

  const cap3 = `# 3. Interoperabilidad con Editores y CI/CD

Los paquetes \`.mdz\` pueden ser emitidos directamente desde vaults de Obsidian, exportadores de Notion, editores de texto plano o agentes autónomos de IA.

MD Organizer actúa como servidor web de consumo e indexación inmediata para estos paquetes.
`;

  const dummyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const coverBuffer = Buffer.from(dummyPngBase64, 'base64');

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
  zip.addFile('metadata/book.json', Buffer.from(JSON.stringify(bookMeta, null, 2), 'utf8'));
  zip.addFile('chapters/01_manifiesto_y_filosofia.md', Buffer.from(cap1, 'utf8'));
  zip.addFile('chapters/02_perfil_de_libros.md', Buffer.from(cap2, 'utf8'));
  zip.addFile('chapters/03_interoperabilidad.md', Buffer.from(cap3, 'utf8'));
  zip.addFile('assets/cover.png', coverBuffer);

  const destZip = path.join(examplesDir, '5_especificacion_mdz_book.mdz');
  zip.writeZip(destZip);
  console.log(`✅ Creado: 5_especificacion_mdz_book.mdz [MDZ Book Profile]`);
}

createMdzBook();
