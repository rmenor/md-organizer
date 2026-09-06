# Design: Mobile-First Library and Integrated Wiki

## Technical Approach

Extend the existing server-rendered HTML plus vanilla JavaScript/CSS. Keep the current bottom tabs, sheets, media breakpoint, upload/search endpoints, and reader data endpoints. Replace duplicated Wiki panes with one source-backed Markdown view while retaining a deliberately short client fallback.

## Architecture Decisions

### Decision: Read the repository guide at request time

**Choice**: Add `GET /api/wiki`, rooted to `WIKI_COMO_HACER_LIBROS.md`, returning `{ content, source }`.
**Alternatives considered**: Duplicating content in HTML or bundling a generated artifact.
**Rationale**: Request-time reading keeps the maintained document authoritative without a build system; fixed server path prevents traversal.

### Decision: Promote Guía & Wiki to a primary view instead of a modal overlay

**Choice**: Transition Guía & Wiki from a popup modal into a full-page primary view (`#wiki-view`) under `#library-view`, coordinated by `showMainView('wiki')`.
**Alternatives considered**: Keeping a modal/bottom-sheet dialog.
**Rationale**: Treating documentation as a top-level section (alongside Publicaciones and Versiones) provides comfortable reading space for long technical Markdown, gives it a permanent navbar tab, updates topbar title ("Guía"), and provides standard back-to-grid navigation.

### Decision: Preserve vanilla frontend and existing overlays

**Choice**: Refine current DOM/CSS classes and state handlers rather than introduce a framework. Keep dialog modals for quick tasks (upload, delete) while using primary views for content navigation.
**Alternatives considered**: React component rewrite or a separate mobile application.
**Rationale**: The repository already has mobile patterns and desktop CSS; a focused change lowers regression and dependency risk.

### Decision: Use one role-based color system for both themes

**Choice**: Define CSS custom properties for surface, text, accent, interactive, overlay, and code-block roles, with light/dark values in the existing theme selectors. Preserve current identity colors where they remain readable; derive hover, focus, active, and disabled states from the same role families rather than adding isolated colors.
**Alternatives considered**: Per-component literals or a new color framework.
**Rationale**: Central tokens keep the palette harmonious, make theme parity explicit, and allow contrast fixes without visual drift across library, reader, sheets, and Wiki surfaces.

### Decision: Treat contrast as an interaction contract

**Choice**: Verify normal text at least 4.5:1, large text at least 3:1, and meaningful control boundaries/focus indicators at least 3:1 against adjacent colors in both themes; check touch controls and modal/drawer content explicitly.
**Alternatives considered**: Subjective visual review only or applying contrast checks only to body text.
**Rationale**: Mobile controls and overlay content are high-use, high-context surfaces where readable text and state visibility must survive both themes and dimmed backgrounds.

### Decision: Sanitize rendered Wiki Markdown

**Choice**: Render only the supported Markdown output and sanitize/remove raw HTML before assigning `innerHTML` (or use a DOM-safe renderer).
**Alternatives considered**: Trusting the local file or injecting raw server output.
**Rationale**: The API boundary should remain safe if the document later contains user-edited content.

## Data Flow

```text
WIKI_COMO_HACER_LIBROS.md → GET /api/wiki → app.js → safe Markdown HTML → #wiki-view (#library-view)
                                            ↘ fallback on failure
Touch/keyboard → app.js or reader.js → classes, focus, fetch → existing APIs
```

## File Changes

| File | Action | Description |
|---|---|---|
| `server.js` | Modify | Add fixed-path read-only Wiki endpoint and sanitized errors. |
| `public/index.html` | Modify | Promote Wiki to primary `<section id="wiki-view">`, remove obsolete modal, update subtab bar and cache-buster. |
| `public/css/styles.css` | Modify | Add `.wiki-view` layout styles, scrollable subtabs bar, centralized role-based colors, and responsive rules. |
| `public/js/app.js` | Modify | Integrate `wikiView` into `showMainView()`, update topbar titles ("Guía"), subtab coordination, and dynamic Markdown rendering. |
| `public/js/reader.js` | Modify | Use `.theme-pill`, correct `.reader-content-scroll`, and synchronize TOC/chapter controls. |
| `tests/test_app.js` | Modify | Add endpoint contract/error tests and preserve processor/database coverage. |

## Interfaces / Contracts

```http
GET /api/wiki
200 application/json
{ "content": "# ...", "source": "WIKI_COMO_HACER_LIBROS.md" }

500 application/json
{ "error": "Wiki content unavailable" }
```

No changes are planned to `/api/tree`, `/api/search`, `/api/upload`, book detail, or chapter endpoints.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit/contract | Wiki success and unreadable-source failure | `node:test`; isolate file-read dependency or test endpoint with repository fixture. |
| Regression | Existing DB, ZIP inference, replacement/conflict, and API response shapes | Existing `tests/test_app.js` plus focused assertions. |
| Browser/manual | 375px, 768px, and desktop; light/dark themes, touch, keyboard, Escape, focus, reader controls, fallback | Dev server smoke checklist; verify no horizontal overflow, reduced motion, harmonious role usage, and contrast for controls plus modal/drawer/code content. |

## Migration / Rollout

No data migration or feature flag. Deliver as a feature-branch chain: API/source wiring first, responsive/reader slice second, verification/polish third. Roll back by reverting the chain in reverse order.

## Open Questions

- None blocking; the user explicitly selected automatic chaining and the repository guide remains authoritative.
