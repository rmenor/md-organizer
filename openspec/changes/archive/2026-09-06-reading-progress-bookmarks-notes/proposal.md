# Proposal: Reading Progress, Bookmarks, and Annotations

## Intent

Add client-side reading progress tracking, custom-labeled chapter bookmarks, and text highlighting with notes to the reader without backend dependencies.

## Scope

### In Scope
- **Reading Progress**: Track last-read chapter and completion status; resume reading position automatically.
- **Bookmarks**: Create, label, list, and delete chapter bookmarks with direct navigation.
- **Annotations & Notes**: Highlight text selections, attach editable notes, render highlights inline, and list annotations.
- **Client Persistence**: Resilient `localStorage` storage manager with namespaced keys.
- **Responsive UI**: Accessible reader toolbar controls, selection popover, and drawer integration.

### Out of Scope
- Backend database migrations, user accounts, or server synchronization.
- Cross-device cloud sync or multi-user sharing.
- External format export (PDF/EPUB).

## Capabilities

### New Capabilities
- `reading-progress`: Automatic tracking and visual indicators of last-read chapter and completion.
- `reading-bookmarks`: Creation, labeling, navigation, and deletion of chapter bookmarks.
- `reading-annotations`: Text range highlighting, note attachment, inline rendering, and list navigation.

### Modified Capabilities
- None.

## Approach

Use a lightweight client storage module (`localStorage` namespaced keys `athenaeum:*`). Extend `reader.js` to manage reading position, capture DOM selections, inject `<mark>` elements into sanitized markdown, and handle bookmark/note interactions. Update `index.html` and `styles.css` with responsive UI controls.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `public/index.html` | Modified | Add bookmark toggle, progress display, annotation popover, and notes drawer. |
| `public/css/styles.css` | Modified | Highlight styling, popover/drawer layouts, and responsive controls. |
| `public/js/reader.js` | Modified | Selection handling, highlight injection, bookmark actions, and progress state. |
| `public/js/storage.js` | New | Client persistence utility for progress, bookmarks, and annotations. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Highlights shift across re-renders | Medium | Store text offsets and normalized node anchors. |
| `localStorage` quota or privacy blocks | Low | Defensive JSON handling with in-memory fallback. |
| Mobile touch selection collisions | Medium | Activate popover only on explicit selection end events. |

## Rollback Plan

Revert client scripts, styles, and HTML changes. No server or database cleanup needed.

## Dependencies

Browser Web Storage API (`localStorage`), DOM Selection and Range APIs. No external libraries.

## Success Criteria

- [ ] Opening a book resumes at the last-read chapter with visible completion indicators.
- [ ] Users can bookmark chapters with custom titles and navigate to them from TOC/panel.
- [ ] Users can highlight text selections, attach notes, and view saved annotations.
- [ ] State persists across reloads via `localStorage`.
- [ ] Controls function smoothly across mobile and desktop viewports.
