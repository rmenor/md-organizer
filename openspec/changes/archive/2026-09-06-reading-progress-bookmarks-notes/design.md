# Technical Design: Reading Progress, Bookmarks, and Annotations

## Technical Approach & Architecture Decisions

This design implements client-side reading progress tracking, custom-labeled chapter bookmarks, and inline text annotations with notes without backend changes.

```
+-----------------------------------------------------------------------------------+
|                                 Browser Client                                    |
|                                                                                   |
|  +---------------------+   +---------------------+   +-------------------------+  |
|  | Reader UI & Topbar  |   | Selection Popover   |   | Unified Drawer          |  |
|  | (Progress / Bookmk) |   | (Highlight & Notes) |   | (TOC / Bookmarks / Notes|  |
|  +----------+----------+   +----------+----------+   +------------+------------+  |
|             |                         |                           |               |
|             v                         v                           v               |
|  +-----------------------------------------------------------------------------+  |
|  |                         Reader Controller (reader.js)                       |  |
|  | - Restores scroll / active chapter   - Injects / unwraps <mark> elements    |  |
|  | - Listens to selection/scroll events - Renders drawer panels & badges       |  |
|  +------------------------------------+----------------------------------------+  |
|                                       |                                           |
|                                       v                                           |
|  +-----------------------------------------------------------------------------+  |
|  |                         Storage Adapter (storage.js)                        |  |
|  | - Namespaced keys: athenaeum:*       - Defensive JSON / Quota fallback      |  |
|  | - Legacy key migration               - In-memory cache                      |  |
|  +------------------------------------+----------------------------------------+  |
|                                       |                                           |
|                                       v                                           |
|                       +-------------------------------+                           |
|                       |  localStorage / Memory Store  |                           |
|                       +-------------------------------+                           |
+-----------------------------------------------------------------------------------+
```

### 1. Storage Architecture (`public/js/storage.js`)
- **Key Namespace**:
  - Progress: `athenaeum:progress:<bookId>`
  - Bookmarks: `athenaeum:bookmarks:<bookId>` (Array of `Bookmark`)
  - Annotations: `athenaeum:annotations:<bookId>` (Array of `Annotation`)
- **Resilience & Fallback**: Operations wrap `localStorage` access in `try/catch`. When blocked (private browsing) or quota is exceeded, data seamlessly persists in an in-memory `Map` per session.
- **Legacy Migration**: Automatically detects and migrates `md_reader_progress_<bookId>` into `athenaeum:progress:<bookId>` upon first access.

### 2. Selection & Text Range Serialization
- **TextQuoteSelector Strategy**: Range anchor uses exact text snippet (`exact`), leading context (`prefix`, ~20 chars), and trailing context (`suffix`, ~20 chars), plus character offsets within `#reader-content`.
- **Sanitized DOM Traversal**: Highlight ranges match text nodes within `#reader-content`. Text matcher finds node boundary spans without breaking existing HTML elements.

### 3. Highlight Injection & DOM Cleanup
- **Injection**: Matching text node fragments are wrapped into `<mark class="reader-highlight highlight-<color>" data-annotation-id="<id>">`.
- **Cleanup**: Highlight removal unwrap `<mark>` elements back into continuous text nodes via `node.replaceWith(...node.childNodes)` and `normalize()`.
- **Click Handling**: Clicking a highlight opens an action popover to view/edit notes or delete the highlight.

### 4. Reader UI Components
- **Topbar Bookmark Toggle**: Button `#btn-reader-bookmark` toggles active chapter bookmark status and allows editing custom labels.
- **Floating Selection Popover**: `#reader-selection-popover` appears near mouseup/touchend selections inside `#reader-content` with color swatches (yellow, green, blue, pink) and note input.
- **Unified Sidebar Drawer**: Extends `#reader-toc` with tabbed navigation: **Índice (TOC)**, **Marcadores (Bookmarks)**, and **Notas (Annotations)**.

---

## File Changes Table

| File | Change Type | Description |
|---|---|---|
| `public/js/storage.js` | **New** | Storage adapter module with `athenaeum:*` schema, legacy migration, and in-memory fallback. |
| `public/js/reader.js` | **Modify** | Integrate storage adapter, selection popover, range highlight injection/unwrapping, drawer tabs, and progress restoration. |
| `public/index.html` | **Modify** | Add bookmark button in reader topbar, selection popover markup, and drawer tab controls for Bookmarks and Annotations. |
| `public/css/styles.css` | **Modify** | Add styles for `<mark.reader-highlight>`, color themes, selection popover, and drawer sub-panels. |
| `tests/test_storage.js` | **New** | Unit and integration test suite for storage adapter, migration, range serialization, and DOM highlight injection. |

---

## Interfaces & Data Contracts

```typescript
interface ReadingProgress {
  bookId: number;
  chapterIndex: number;
  chapterId: number;
  scrollTop: number;
  updatedAt: number; // Unix timestamp (ms)
}

interface Bookmark {
  id: string; // "bm_<timestamp>_<rand>"
  bookId: number;
  chapterIndex: number;
  chapterId: number;
  label: string;
  createdAt: number;
}

type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

interface TextSelector {
  exact: string;
  prefix: string;
  suffix: string;
  startOffset: number;
  endOffset: number;
}

interface Annotation {
  id: string; // "ann_<timestamp>_<rand>"
  bookId: number;
  chapterIndex: number;
  chapterId: number;
  text: string;
  note: string;
  color: HighlightColor;
  selector: TextSelector;
  createdAt: number;
  updatedAt: number;
}
```

### Storage Adapter API (`StorageAdapter`)

```javascript
const StorageAdapter = {
  getProgress(bookId): ReadingProgress | null,
  saveProgress(bookId, progressData): boolean,
  getBookmarks(bookId): Bookmark[],
  saveBookmark(bookId, bookmark): Bookmark[],
  removeBookmark(bookId, bookmarkId): Bookmark[],
  getAnnotations(bookId, chapterId?): Annotation[],
  saveAnnotation(bookId, annotation): Annotation[],
  updateAnnotation(bookId, annotationId, updates): Annotation[],
  removeAnnotation(bookId, annotationId): Annotation[]
};
```

---

## Testing Strategy

1. **Storage Adapter Tests (`tests/test_storage.js`)**:
   - Save, load, and clear `progress`, `bookmarks`, and `annotations`.
   - Migration test: ensure `md_reader_progress_<bookId>` is converted to `athenaeum:progress:<bookId>`.
   - Quota/error fallback: verify operations succeed when `localStorage` throws.
2. **Text Range & Highlight Injection Tests**:
   - Test text matching across mixed inline DOM nodes (`<code>`, `<strong>`, `<em>`).
   - Validate `<mark>` injection, color class assignment, and clean DOM unwrap on delete.
3. **UI Integration Verifications**:
   - Validate topbar bookmark state sync when switching chapters.
   - Validate deep navigation: clicking an annotation in the drawer navigates to the chapter and scrolls to `<mark>`.

---

## Migration & Rollout

- **Backward Compatibility**: Existing client progress stored under `md_reader_progress_*` is lazily migrated on reader load.
- **Rollout**: Pure client-side static asset release. No server schema changes or database migrations required.
