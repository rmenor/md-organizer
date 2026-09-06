# Proposal: Mobile-First Library and Integrated Wiki

## Intent

Make Athenaeum dependable on smartphones and tablets without regressing desktop use, while replacing duplicated in-page Wiki copy with the maintained `WIKI_COMO_HACER_LIBROS.md` document.

## Scope

### In Scope
- Refine touch navigation, compact search, off-canvas sections, full-width reader, mobile TOC, chapter controls, responsive upload sheets, and a cohesive accessible color system.
- Promote Guía & Wiki to a primary full-page view (`#wiki-view`) under `#library-view` with topbar title switching ("Guía") and subtab navigation.
- Fix reader control selectors and chapter-scroll dead code discovered during mobile work.
- Expose the source Markdown through a small read-only endpoint and render it interactively with a safe client fallback.
- Add keyboard, focus, labeling, reduced-motion, touch-target, color-state, and contrast behavior plus automated contract tests and manual viewport verification.

### Out of Scope
- Redesigning backend book processing, ZIP inference, storage, or versioning behavior.
- Adding a frontend framework, build step, or new persistence layer.
- Changing the existing desktop information architecture or the source document’s editorial content.

## Capabilities

### New Capabilities
- `responsive-library-reader`: Responsive library, reader, navigation, search, upload modal, and accessible touch/keyboard interactions.
- `integrated-wiki`: Source-backed interactive documentation delivered by API as a primary application view with safe fallback.

### Modified Capabilities
- None (no main OpenSpec capabilities exist in this repository).

## Approach

Keep the existing vanilla JS, HTML, CSS, Express, `marked`, and `node:test` architecture. Preserve current mobile sheets and desktop media-query behavior. Promote Guía & Wiki to a top-level application section alongside Publicaciones and Versiones, switching the topbar title and showing subtabs. Add `GET /api/wiki` that reads the repository Markdown, returns the documented JSON contract, and fails safely. Render sections from the fetched document rather than maintaining a second long-form Wiki.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `public/index.html` | Modified | Primary `<section id="wiki-view">`, removed obsolete modal, updated subtabs. |
| `public/css/styles.css` | Modified | Smartphone/tablet/desktop refinements, `.wiki-view` layout, centralized theme color tokens, coherent states, focus, motion, and reader layout. |
| `public/js/app.js` | Modified | Navigation state (`showMainView`), topbar title coordination ("Guía"), Wiki loading/rendering, fallback, and modal accessibility. |
| `public/js/reader.js` | Modified | Correct theme controls/scroll target and accessible TOC/chapter navigation. |
| `server.js` | Modified | Read-only Wiki endpoint with safe failure behavior. |
| `tests/test_app.js` | Modified | API and existing behavior regression coverage. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Markdown source and UI drift | Med | Single endpoint/source; fallback is intentionally short and tested. |
| Overlay changes regress desktop or keyboard use | Med | Preserve breakpoint rules; test Escape, focus, and desktop smoke paths. |
| Existing reader dead code masks failures | Med | Add selector/scroll regression checks and manual reader verification. |
| Color changes reduce identity or readability | Med | Preserve existing identity colors where possible, map all roles to theme tokens, and verify contrast in both themes. |

## Rollback Plan

Revert the feature chain in reverse order. The only server addition is read-only; removing it restores the current API surface. Restore the existing Wiki markup and prior JS/CSS if dynamic rendering or overlay behavior proves unstable. No data migration or backend processor change is required.

## Dependencies

- Existing Express static serving, `marked`, Highlight.js, and `node:test`; no new package dependency.

## Success Criteria

- [ ] Core library, reader, upload, search, and Wiki flows work at phone, tablet, and desktop widths.
- [ ] Wiki UI content is loaded from `WIKI_COMO_HACER_LIBROS.md`, with a safe visible fallback on API failure.
- [ ] `npm test` passes, including Wiki endpoint/error and existing ZIP-processing regressions.
- [ ] Keyboard and touch paths meet the documented interaction and accessibility scenarios.
- [ ] Light and dark themes use harmonious role-based colors, coherent interaction states, and readable contrast for touch controls and modal/drawer content.
