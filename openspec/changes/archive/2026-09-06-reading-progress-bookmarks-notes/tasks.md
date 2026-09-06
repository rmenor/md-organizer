# Tasks: Reading Progress, Bookmarks, and Annotations

## Phase 1: Storage Adapter & Unit Tests

- [x] 1.1 **[RED]** Create unit test suite in `tests/test_storage.js` validating `StorageAdapter` methods (`getProgress`, `saveProgress`, `getBookmarks`, `saveBookmark`, `removeBookmark`, `getAnnotations`, `saveAnnotation`, `removeAnnotation`), legacy `md_reader_progress_*` migration, and in-memory fallback on `QuotaExceededError`.
- [x] 1.2 **[GREEN]** Implement `StorageAdapter` in `public/js/storage.js` with `athenaeum:*` namespacing, defensive JSON serialization, and memory store fallback.
- [x] 1.3 **[REFACTOR]** Standardize export patterns for browser `<script>` tag and Node.js test environments.

## Phase 2: Highlight & Annotation Engine

- [x] 2.1 **[RED]** Create tests in `tests/test_annotations.js` covering selection serialization (`exact`, `prefix`, `suffix`, offsets), `<mark class="reader-highlight">` DOM injection across mixed text nodes, and `<mark>` unwrapping on deletion.
- [x] 2.2 **[GREEN]** Implement annotation range matching, `<mark>` injection, color class handling (`yellow`, `green`, `blue`, `pink`), and unwrap cleanup in `public/js/annotations.js`.
- [x] 2.3 **[REFACTOR]** Optimize text node traversal and call `node.normalize()` to avoid DOM fragmentation.

## Phase 3: Bookmarks & UI Integration

- [x] 3.1 **[RED]** Write integration tests for reader bookmark toggle state, selection popover trigger events, and drawer panel tab switching.
- [x] 3.2 **[GREEN]** Update `public/index.html` and `public/css/styles.css` with topbar bookmark button, floating selection popover, and tabbed sidebar drawer (**TOC**, **Marcadores**, **Notas**).
- [x] 3.3 **[GREEN]** Wire `public/js/bookmarks.js` and `public/js/reader.js` to persist progress on scroll, resume reading position on load, render bookmark/annotation badges, and handle deep navigation jumps to `<mark>` highlights.
- [x] 3.4 **[REFACTOR]** Ensure responsive layout on mobile/desktop viewports and debounce scroll progress updates.

## Phase 4: Full Verification & Spec Scenario Validation

- [x] 4.1 Update `package.json` test script to execute all test files (`node --test tests/test_*.js`).
- [x] 4.2 Verify all specification scenarios across `reading-progress`, `reading-bookmarks`, and `reading-annotations`.
- [x] 4.3 Run full test suite `npm test` and confirm zero regressions.

---

## Review Workload Forecast

- **Estimated Total Delta**: ~380 lines of production code, ~180 lines of tests.
  - `public/js/storage.js`: +80 lines
  - `public/js/annotations.js`: +110 lines
  - `public/js/bookmarks.js` & `public/js/reader.js`: +120 lines
  - `public/index.html` & `public/css/styles.css`: +70 lines
  - `tests/test_storage.js` & `tests/test_annotations.js`: +180 lines
- **Line Budget Assessment**: Low risk. Core logic is modularized across isolated files, keeping individual file diffs well under the 400-line review limit.
- **Chained PR Recommendation**: 
  - *Option A (Recommended)*: Single PR (<400 net production LOC) with isolated commits per phase.
  - *Option B (Split)*: PR 1 (Phases 1-2: Core engine + tests) & PR 2 (Phases 3-4: UI controls + integration).
