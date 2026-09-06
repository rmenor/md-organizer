<p align="center">
  <img src="https://raw.githubusercontent.com/rmenor/md-organizer/main/public/assets/logo.png" alt="MD Organizer Logo" width="160"/>
</p>

<h1 align="center">MD Organizer (Athenaeum)</h1>

<p align="center">
  <strong>The self-hosted, distraction-free digital library & web reader for Markdown books and technical documentation.</strong>
</p>

<p align="center">
  <a href="https://md-organizer.vercel.app/"><img src="https://img.shields.io/badge/Demo-Live%20Preview-8e44ad?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo"/></a>
  <a href="https://github.com/rmenor/md-organizer/stargazers"><img src="https://img.shields.io/github/stars/rmenor/md-organizer?style=for-the-badge&color=f39c12" alt="GitHub Stars"/></a>
  <a href="https://github.com/rmenor/md-organizer/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="License"/></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18%2B-green.svg?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/></a>
  <a href="https://sqlite.org/"><img src="https://img.shields.io/badge/Database-SQLite3-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite3"/></a>
</p>

---

<p align="center">
  <a href="#-live-demo">Live Demo</a> •
  <a href="#-why-md-organizer">Why MD Organizer?</a> •
  <a href="#-key-features">Key Features</a> •
  <a href="#-book-package-format">Book Package Format</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-deployment">Deployment</a> •
  <a href="#-versión-en-español">Español</a>
</p>

---

## 🚀 Live Demo

Try the application right now without installing anything:

👉 **[https://md-organizer.vercel.app/](https://md-organizer.vercel.app/)**

*Feel free to browse existing books, switch themes, navigate chapters, or upload your own `.zip` Markdown book!*

---

## 💡 Why MD Organizer?

Most existing tools for reading and documentation fall into three categories that don't quite fit the needs of structured Markdown collections:

- **Static Site Generators (Docusaurus, VitePress, MkDocs, mdBook)**: Excellent for project docs, but require git pushes, CI/CD pipelines, and full-site recompilation just to add or update a publication.
- **E-Book Servers (Calibre-Web, Kavita, Ubooquity)**: Built around EPUB, MOBI, and PDF formats. They treat Markdown as an alien format or don't support multi-chapter Markdown bundles with assets natively.
- **Note-Taking Apps (Obsidian, Notion, Logseq)**: Built for writing and personal knowledge management, but cumbersome for publishing and distributing read-only books to users, teams, or students.

**MD Organizer bridges this gap:** It is a standalone, lightweight web library and reader where a publication is either a standard **`.mdz`** archive (Markdown Zip specification with Book Profile) or a simple **`.zip`** bundle. Drag and drop it into the web UI, and you instantly get a categorized, versioned, searchable digital library with a reading experience inspired by modern e-readers like Apple Books.

---

## ✨ Key Features

### 📦 Dual Format Ingestion: `.mdz` & `.zip`
Drop any `.mdz` or `.zip` book package directly into the browser. MD Organizer automatically detects the package architecture:
- **MDZ Book Profile**: Parses `manifest.json` and `metadata/book.json`, maps chapters from `chapters/`, and assets from `assets/`. Ready for automated exports from Obsidian, GitHub Actions, AI pipelines, and headless CMSs.
- **Direct / Simple Profile**: Reads root `metadata.json` and Markdown chapters. Enables creating a book bundle in seconds.
- **Automatic Fallback**: Infers book titles, authors, versions, dates, and chapters from YAML frontmatter or document headings if no metadata file is provided.

### 🔄 Smart Versioning & Collision Guard
Never lose your reading notes or overwrite content accidentally:
- Each book carries a unique code (`code`), version tag (`version`: e.g. `1.0.0` vs `2.0.0`), and publication date (`publication_date`).
- **Auto-Update**: If an uploaded book matches an existing code with a newer date/version, the system seamlessly replaces it.
- **Downgrade Protection**: If an uploaded version is older or identical to the installed one, the system detects the collision and warns you before making changes.

### 🛡️ Safe Import — Existing Books Are Never Corrupted
Before touching any file on disk or any database record, every upload goes through a full in-memory validation pass. Only if **all checks pass** does the system write anything — and it does so atomically:

| Check | What it verifies |
|---|---|
| Non-empty archive | ZIP/MDZ contains at least one file |
| Markdown chapters present | At least one `.md` file exists |
| Manifest integrity | Every chapter declared in `manifest.json` / `metadata.json` can actually be read from the archive |
| No empty chapters | Each Markdown file has non-blank content |
| Valid version string | `version` field starts with a digit (e.g. `1.0.0`, `2.0`, `3`) |
| Title present | Book has a non-empty title |

If any check fails, the upload is **rejected with a clear error message** listing each problem — and the existing book in the library remains **100% untouched**. If a write error or database failure occurs mid-import, the staging directory is automatically cleaned up before the error is surfaced.

### 📖 Distraction-Free Web Reader
- **Automatic Reading Resume (`localStorage`)**: Never lose your spot. MD Organizer automatically remembers the exact chapter and scroll position where you left off. Reopening any book instantly resumes right where you were, accompanied by in-library reading badges (`Cap. X`) and a subtle resume notification.
- **3 Color Themes**: Dark Mode, Sepia (warm reading), and Light Mode.
- **Dynamic Typography**: Increase or decrease font size with on-screen controls.
- **Smooth Chapter Navigation**: Step forward or backward through chapters (`‹ Anterior` / `Siguiente ›`) or jump directly using the collapsible Table of Contents (TOC) drawer.
- **Syntax Highlighting**: Code snippets are automatically highlighted with `highlight.js`.
- **Responsive Mobile First**: Reading controls and swatches slide into a clean sidebar drawer on mobile devices, keeping your viewport 100% focused on reading.

### 🗂️ Dynamic Categorization
- Automatically derives **Sections** and **Subsections** from book metadata.
- Renders an interactive category grid with contextual SVG icons (Software Engineering, Databases, DevOps, Design, Guides, etc.).
- Filter publications by section, subsection, or live keyword search.

### ⚡ Zero-Bloat, High-Performance Architecture
- **No heavy frontend frameworks**: Built with pristine, vanilla HTML5, CSS3, and modern JavaScript. Sub-50ms initial load time.
- **Embedded SQLite3 (`better-sqlite3`)**: Zero setup, ACID-compliant, blazing fast queries with WAL mode.
- **Serverless & Self-Host Ready**: Runs effortlessly on Vercel, Docker, Raspberry Pi, or any cheap VPS.

---

## 📁 Book Package Formats

MD Organizer natively supports two package layouts:

### A. MDZ Specification (Book Profile — `.mdz` / `.zip`)
The portable, interoperable standard for technical books and long-form publications:

```text
my-book.mdz
├── manifest.json                 # Package manifest
├── metadata/
│   └── book.json                 # Editorial metadata and chapter sequence
├── chapters/
│   ├── 01_intro.md
│   ├── 02_installation.md
│   └── 03_architecture.md
└── assets/
    ├── cover.webp
    └── diagram-01.png
```

#### `manifest.json`
```json
{
  "format": "mdz",
  "version": "1.0",
  "profile": "book",
  "metadata": "metadata/book.json",
  "assets": "assets/"
}
```

#### `metadata/book.json`
```json
{
  "code": "BK-MDZ-SPEC",
  "version": "1.0.0",
  "publication_date": "2026-09-06",
  "title": "MDZ Specification & Book Profile",
  "author": "Markdown Packaging Working Group",
  "description": "Portable Markdown Zip packaging standard for versioned publications.",
  "section": "Architecture",
  "subsection": "Standards",
  "cover": "assets/cover.webp",
  "chapters": [
    { "title": "1. Introduction", "file": "chapters/01_intro.md" },
    { "title": "2. Installation", "file": "chapters/02_installation.md" }
  ]
}
```

---

### B. Direct Flat Format (`.zip`)
Simple, flat structure for creating books in 30 seconds without subfolders:

```text
my-awesome-book.zip
├── metadata.json
├── 01_introduction.md
├── 02_core_architecture.md
└── assets/
    └── cover.png
```

> **Tip**: You can compress your book folder with:
> ```bash
> zip -r ../MyBook.mdz . -x ".*"
> ```

---

## 🧪 Included Test Samples

The [`examples/`](examples/) directory includes ready-to-test `.zip` and `.mdz` books:

1. **`1_libro_codigo_limpio_v1.zip`** (`v1.0.0`, `2024-01-15`): Base version.
2. **`2_libro_antiguo_v0.9_rechazado.zip`** (`v0.9.0`, `2023-10-01`): Test collision rejection (alerts that a newer version is already installed).
3. **`3_libro_nuevo_v2_actualizado.zip`** (`v2.0.0`, `2025-06-01`): Test automatic replacement (upgrades in-place to v2).
4. **`4_sqlite_guia_auto.zip`**: Guide to SQLite with automatic metadata inference from frontmatter.
5. **`5_especificacion_mdz_book.mdz`**: Reference package implementing the **MDZ Book Profile** specification.

---

## 🚀 Quick Start (Local Setup)

### 1. Clone the repository
```bash
git clone https://github.com/rmenor/md-organizer.git
cd md-organizer
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

### 4. (Optional) Run tests
```bash
npm test
```

---

## ☁️ Deployment

### Deploy on Vercel
The repository is pre-configured with `vercel.json` and a serverless entrypoint in `api/index.js` (automatically redirects database and uploads to `/tmp` in serverless environments):

1. Fork or push this repository to GitHub.
2. Import the project into your [Vercel Dashboard](https://vercel.com).
3. Click **Deploy**. Done!

### Deploy on Docker / VPS
Run with Node.js directly or mount behind Nginx/Caddy:
```bash
PORT=8080 node server.js
```

---

## 🇪🇸 Versión en Español

**MD Organizer** es una biblioteca digital y lector web autocontenido para publicaciones en Markdown empaquetadas en archivos **`.MDZ`** (especificación Markdown Zip con Book Profile) y **`.ZIP`** (formato directo).

### ¿Por qué es diferente?
- **Compatibilidad Dual e Interoperable**: Ingiere paquetes estándar `.mdz` (con `manifest.json`, `metadata/book.json` y carpetas `chapters/` y `assets/`) y archivos directos `.zip`. Compatible con exportadores de Obsidian, Notion, pipelines de GitHub Actions y generadores automáticos.
- **Sin compilaciones pesadas**: No necesitas regenerar el sitio web ni hacer commits para agregar libros como en Docusaurus o MkDocs.
- **Control de Versiones inteligente**: Detecta el código del libro (`code`), compara números de versión y fechas de publicación, actualizando automáticamente las nuevas ediciones o advirtiendo para evitar pérdidas.
- **Importación segura — el libro existente nunca se destruye**: Antes de escribir nada en disco ni en la base de datos, cada subida pasa por una validación completa en memoria. Solo si todos los checks son correctos (archivo no vacío, capítulos Markdown presentes, capítulos del manifest accesibles, sin capítulos vacíos, título y versión válidos) el sistema escribe los archivos en un directorio de staging y después ejecuta la transacción de base de datos. Si algo falla en cualquier punto, el staging se elimina automáticamente y el libro anterior queda **intacto**. Los errores se muestran como lista detallada en el modal de subida.
- **Lector web libre de distracciones**:
  - **Reanudación automática de lectura (`localStorage`)**: Guarda automáticamente tu capítulo y posición de desplazamiento exacta para continuar donde lo dejaste nada más abrir el libro, indicando el capítulo en curso en la biblioteca.
  - Modos **Oscuro**, **Sepia** y **Claro**.
  - Paginación capítulo por capítulo y selector dinámico de tamaño de fuente.
  - Tabla de contenidos (TOC) desplegable y resaltado de sintaxis con `highlight.js`.
  - Adaptado 100% para lectura cómoda en móviles y tablets.
- **Ligero y Rápido**: Backend en Node.js con SQLite3 (`better-sqlite3`) y frontend vanilla sin dependencias pesadas.


---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](https://github.com/rmenor/md-organizer/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">
  ⭐ <strong>If you found this project interesting or useful, please consider giving it a star on GitHub!</strong> ⭐
</p>
