# Integrated Wiki Specification

## Purpose

Make the maintained Markdown guide the single source of truth for interactive in-app documentation about book creation and ZIP import.

## ADDED Requirements

### Requirement: Source-backed Wiki endpoint

The server MUST expose a read-only `GET /api/wiki` endpoint that reads `WIKI_COMO_HACER_LIBROS.md` from the repository and returns a stable JSON contract `{ "content": string, "source": string }` with `200 OK` when available. It MUST NOT accept paths or write files.

#### Scenario: Serve current guide

- GIVEN `WIKI_COMO_HACER_LIBROS.md` exists
- WHEN a client requests `GET /api/wiki`
- THEN the response is successful, identifies the source document, and contains its current Markdown including metadata, inference, and macOS/Windows/Linux ZIP guidance.

#### Scenario: Source read failure

- GIVEN the guide is unavailable or unreadable
- WHEN a client requests `GET /api/wiki`
- THEN the server returns a non-success JSON error without exposing filesystem paths or stack traces.

### Requirement: Interactive Wiki rendering as primary application view

The client MUST provide the Guide & Wiki as a primary top-level view (`#wiki-view`) alongside Publicaciones and Versiones under the main application view (`#library-view`). When selected via subtab navigation (`#tab-btn-wiki`) or route `#wiki`:
1. The topbar title MUST replace "Biblioteca" with "Guía" and subtitle "Documentación & Formato".
2. The subtab button MUST be marked active and the back button (`#btn-back-to-grid`) MUST be displayed to allow easy return to the library grid.
3. The client MUST render internal subtabs (`Guía Rápida`, `Plantilla metadata.json`, `Documentación Completa`, `Versión & GitHub`).
4. In `Documentación Completa`, the client MUST load Wiki content from `/api/wiki` and render safe Markdown into the view container.
5. Returning to Publicaciones or pressing Escape MUST restore the topbar title to "Biblioteca" and display the category grid.

#### Scenario: Open and navigate Wiki as primary view

- GIVEN the user is on the library grid or any other view
- WHEN the user clicks "GUÍA & WIKI" in the subnav or navigates to `#wiki`
- THEN the topbar title switches to "Guía", the back button appears, and the `#wiki-view` is revealed with internal tabs
- AND clicking any internal tab chip toggles the respective guide pane smoothly
- AND clicking the back button or "PUBLICACIONES" restores the title to "Biblioteca" and shows the library categories.

#### Scenario: Wiki fallback

- GIVEN `/api/wiki` fails or returns malformed content
- WHEN the user opens the "Documentación Completa" tab in the Wiki view
- THEN a short safe fallback explains the required Markdown/ZIP shape and points to the local guide conceptually
- AND the UI reports a recoverable state rather than showing blank or unsafe HTML.

### Requirement: Wiki security and content integrity

Rendered Wiki content MUST be treated as untrusted input at the HTML boundary, and code-copy actions MUST copy only the displayed template text.

#### Scenario: Markup and copy handling

- GIVEN the source includes code blocks, links, or HTML-like text
- WHEN it is rendered or copied
- THEN unsafe HTML is not executed and copy returns the intended code text without altering upload/search state.

### Requirement: Wiki surface color readability

The Wiki view and rendered code blocks MUST use the shared role-based surface, text, accent, and code-block color tokens from the responsive interface. Their light/dark theme variants MUST preserve harmonious identity and meet the documented text and control contrast thresholds.

#### Scenario: Readable Wiki view in both themes

- GIVEN the Wiki is opened in light or dark mode
- WHEN headings, body text, links, code blocks, tabs, and focus states are displayed
- THEN each remains readable against its immediate surface and preserves active state and focus indicators clearly.
