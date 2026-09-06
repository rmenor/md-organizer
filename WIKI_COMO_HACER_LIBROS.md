# 📖 Documentación Completa: Cómo Crear y Comprimir Libros Markdown

Esta guía exhaustiva detalla la especificación completa, arquitectura de archivos, metadatos, sintaxis soportada y procedimientos de empaquetado para importar publicaciones en **MD Organizer (Athenaeum)**.

---

## 1. Visión General del Formato: Compatibilidad Dual (.ZIP y .MDZ)

MD Organizer cuenta con un motor de ingesta inteligente (**Smart Ingestion**) con soporte nativo y simultáneo para dos formatos complementarios:

1. **Especificación MDZ (`.mdz` / `.zip` con Book Profile)**: Estándar abierto, portable e interoperable concebido para empaquetado formal de publicaciones versionadas. Utiliza un manifiesto universal (`manifest.json`), metadatos declarativos (`metadata/book.json`), capítulos anidados en `chapters/` y recursos en `assets/`. Ideal para generación desde Obsidian, GitHub Actions, editores y flujos de publicación automatizados.
2. **Formato Directo / Legacy (`.zip`)**: Formato ultra-rápido donde los capítulos `.md` y el archivo `metadata.json` conviven directamente en la raíz. Permite crear un libro listo para publicar en 30 segundos.

El sistema garantiza una experiencia de lectura fluida con modo oscuro de alto contraste, escala tipográfica dinámica y reanudación automática de lectura mediante `localStorage`.

---

## 2. Estructuras de Directorios Soportadas

### Opción A: Especificación MDZ (Book Profile - `.mdz` o `.zip`)

La arquitectura estandarizada para libros portables e interoperables:

```text
mi-libro.mdz (o .zip)
├── manifest.json                 # Manifiesto principal del paquete MDZ
├── metadata/
│   └── book.json                 # Ficha editorial, código, versión y capítulos
├── chapters/                     # Directorio canónico de capítulos Markdown
│   ├── 01_introduccion.md
│   ├── 02_instalacion.md
│   └── 03_arquitectura.md
└── assets/                       # Recursos visuales y diagramas
    ├── cover.webp                # Portada del libro
    └── diagrama-01.png           # Recursos multimedia enlazados
```

### Opción B: Formato Directo Rápido (`.zip`)

Estructura plana para crear libros rápidamente:

```text
mi-libro.zip
├── metadata.json                 # Configuración principal y metadatos
├── 01_introduccion.md            # Capítulo 1
├── 02_instalacion.md             # Capítulo 2
├── 03_arquitectura.md            # Capítulo 3
└── assets/                       # Recursos visuales
    ├── cover.png                 # Portada del libro
    └── diagrama-01.png           # Diagramas referenciados
```

> **Regla de oro de compresión:** Debe comprimir los **elementos internos** de su libro, de modo que `manifest.json` o `metadata.json` residan en la raíz del archivo comprimido. No comprima la carpeta contenedora externa.

---

## 3. Especificación de Manifiesto y Metadatos

### Perfil MDZ: `manifest.json` y `metadata/book.json`

En un paquete MDZ, `manifest.json` declara el formato y referencia la metadata editorial:

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
  "date": "2026-09-06",
  "title": "Especificación MDZ y Perfil de Libros",
  "author": "Markdown Packaging Working Group",
  "description": "Especificación abierta de empaquetado portable de publicaciones Markdown versionadas.",
  "section": "Arquitectura",
  "subsection": "Estándares Web",
  "language": "es",
  "cover": "assets/cover.webp",
  "chapters": [
    {
      "title": "1. Manifiesto y Filosofía MDZ",
      "file": "chapters/01_manifiesto.md"
    },
    {
      "title": "2. Perfil de Libros y Capítulos",
      "file": "chapters/02_perfil_libros.md"
    }
  ]
}
```

---

### Formato Directo: `metadata.json`

En el formato directo `.zip`, todos los metadatos se concentran en `metadata.json`:

```json
{
  "code": "BK-CLEAN-CODE",
  "version": "1.0.0",
  "date": "2026-09-05",
  "title": "Código Limpio y Arquitectura Ágil",
  "author": "Robert C. Martin & Colaboradores",
  "description": "Manual de estilo, diseño de software y buenas prácticas de ingeniería.",
  "section": "Ingeniería de Software",
  "subsection": "Buenas Prácticas",
  "language": "es",
  "cover": "assets/cover.png",
  "chapters": [
    {
      "title": "Capítulo 1: Nombres con Sentido",
      "file": "01_introduccion.md"
    },
    {
      "title": "Capítulo 2: Funciones Limpias",
      "file": "02_fundamentos.md"
    }
  ]
}
```

### Diccionario de Campos

| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :---: | :--- |
| `code` | `string` | **Recomendado** | Identificador único del libro (ej: `BK-CLEAN-CODE`). Normalizado automáticamente en mayúsculas. Es la clave usada para la detección de nuevas versiones. |
| `version` | `string` | Opcional | Versión semántica mostrada en los registros (ej: `1.0.0`, `2.1.0`). |
| `date` | `string` | **Recomendado** | Fecha de edición en formato ISO `AAAA-MM-DD` (ej: `2026-09-05`). Se utiliza para decidir sustituciones automáticas. |
| `title` | `string` | **Recomendado** | Título visible del libro en la biblioteca y cabecera del lector. |
| `author` | `string` | Opcional | Nombre del autor o entidad editorial. Por defecto: `Autor Desconocido`. |
| `description` | `string` | Opcional | Sinopsis o resumen de la obra. |
| `cover` | `string` | Opcional | Ruta relativa a la imagen de portada dentro del ZIP (ej: `assets/cover.png`). |
| `language` | `string` | Opcional | Código de idioma (ej: `es`, `en`). |
| `chapters` | `array` | Opcional | Lista ordenada de capítulos. Cada objeto requiere `title` y `file`. Si se omite, los capítulos se ordenan alfabéticamente por nombre de archivo. |

---

## 4. Inferencia Automática (Sin `metadata.json`)

Si sube un archivo ZIP sin `metadata.json`, el motor de Athenaeum infiere automáticamente toda la información:

1. **Título de la obra:**
   - Se busca la propiedad `title:` en el frontmatter YAML del primer Markdown.
   - Si no existe, se extrae el primer encabezado `# Título` del archivo.
   - Si no hay encabezados, se toma el nombre del fichero ZIP limpiando guiones y extensiones.
2. **Autor y descripción:**
   - Se leen las claves `author:` y `description:` del frontmatter YAML del primer capítulo si están presentes.
3. **Código de versión y fecha:**
   - Se toma el código del YAML o se deriva del título normalizado. La fecha se asigna al día actual de importación (`1.0.0`).
4. **Capítulos:**
   - Se descubren todos los archivos `.md` del paquete y se ordenan de forma natural (`01`, `02`, `10`). El título de cada capítulo se obtiene de su encabezado `#` inicial o nombre de archivo.
5. **Portada:**
   - Se inspecciona si existe una imagen llamada `cover.*` o `portada.*` (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`).

### Ejemplo de Frontmatter YAML compatible

```markdown
---
title: Arquitectura de Sistemas Distribuidos
author: Margaret Hamilton
code: BK-SIST-DIST
version: 1.2.0
date: 2026-09-05
description: Principios de diseño para servicios desacoplados y resilientes.
---

# Capítulo 1: Fundamentos de Concurrencia

Texto del capítulo aquí...
```

---

## 5. Portadas y Recursos Multimedia

- **Formatos admitidos:** PNG, JPG, JPEG, WEBP, SVG y GIF.
- **Ruta de almacenamiento:** Coloque las imágenes en una subcarpeta `assets/` dentro del libro.
- **Referencias en Markdown:** Utilice siempre rutas relativas dentro de los archivos Markdown:
  ```markdown
  ![Diagrama de Arquitectura](assets/diagrama.png)
  ```
- **Portadas generadas automáticamente:** Si no proporciona una imagen de portada, Athenaeum genera un diseño editorial sobrio y cuadrado con el título en relieve sobre gradientes elegantes (esmeralda, rubí, azul marino, obsidiana o púrpura imperial).

---

## 6. Sistema Inteligente de Control de Versiones

Athenaeum implementa un algoritmo de reemplazo seguro para evitar pérdidas accidentales:

```text
[Nuevo ZIP con código "BK-01"]
          │
          ▼
¿Existe ya en la base de datos?
     ├─ NO  ──► Inserta nuevo libro en biblioteca.
     └─ SÍ  ──► Compara fechas de publicación:
                 ├─ Fecha NUEVA > Fecha INSTALADA ──► Sustituye automáticamente la versión anterior.
                 └─ Fecha NUEVA <= Fecha INSTALADA ──► Rechaza la subida (409 Conflict) para proteger la versión superior.
```

- **Para actualizar un libro:** Edite `date` en `metadata.json` colocando una fecha más reciente e incremente `version`. El sistema actualizará los capítulos, imágenes y textos reemplazando la versión previa de manera atómica.

---

## 7. Sintaxis Markdown Soportada en el Lector

El visor integrado soporta la especificación GitHub Flavored Markdown (GFM) completa:

- **Encabezados:** `# H1` hasta `###### H6`.
- **Formato:** **Negrita**, *cursiva*, ~~tachado~~ y `código inline`.
- **Bloques de código:** Con resaltado de sintaxis automático para JavaScript, Python, Bash, SQL, JSON, HTML, CSS, C, Go, Rust, etc.
- **Listas:** Numeradas, con viñetas y listas de tareas interactivas (`- [x] Completado`).
- **Citas en bloque:** `> Texto de cita con borde lateral de contraste`.
- **Tablas:** Totalmente formateadas con bordes nítidos de alta visibilidad.
- **Líneas divisorias:** `---` para separar secciones lógicas.

---

## 8. Guía de Compresión Paso a Paso

### En macOS (Finder)
1. Abra la carpeta donde tiene preparados sus Markdown y la carpeta `assets/` (o la estructura MDZ con `manifest.json`, `metadata/` y `chapters/`).
2. Seleccione todos los elementos juntos (`Cmd + A`).
3. Haga clic derecho sobre la selección y elija **Comprimir elementos**.
4. Se generará `Archivo.zip`. Puede conservarlo como `MiLibro.zip` o renombrarlo a `MiLibro.mdz`.

### En Windows (Explorador de Archivos)
1. Entre en la carpeta de su libro.
2. Seleccione los archivos internos (o la estructura MDZ).
3. Haga clic derecho en la selección y elija **Enviar a > Carpeta comprimida (en zip)** o **Comprimir a archivo ZIP**.
4. Asigne el nombre deseado con extensión `.zip` o `.mdz`.

### En Linux / macOS (Terminal)
Abra su terminal, sitúese dentro de la carpeta del libro y ejecute:
```bash
cd /ruta/a/mi-libro

# Para paquete .zip directo:
zip -r ../MiLibro.zip . -x ".*"

# Para paquete portable .mdz:
zip -r ../MiLibro.mdz . -x ".*"
```

---

## 9. Preguntas Frecuentes y Diagnóstico

- **¿Por qué da error "Solo se permiten archivos .zip o .mdz"?**
  Asegúrese de que el archivo tenga extensión `.zip` o `.mdz` y no esté dañado ni renombrado desde un archivo `.rar` o `.7z`.
- **¿Qué diferencia hay entre subir un .zip y un .mdz?**
  Ambos son consumidos de forma transparente por el servidor. `.mdz` sigue la convención portable con `manifest.json` y `metadata/book.json`, lo que facilita la interoperabilidad con generadores automáticos, editores como Obsidian y pipelines de CI/CD.
- **¿Qué ocurre si los títulos tienen tildes o caracteres especiales?**
  MD Organizer procesa codificación UTF-8 de forma nativa en títulos, contenidos y nombres de archivo.
- **¿Por qué aparece el mensaje de versión conflictiva?**
  Si el libro ya existe con el mismo `code`, verifique que la fecha (`date`) del archivo nuevo sea posterior a la instalada.
- **¿Puedo publicar un libro de un solo archivo?**
  Sí, un único fichero `01_libro_completo.md` dentro de un paquete `.zip` o `.mdz` es suficiente para generar el libro de forma inmediata.
