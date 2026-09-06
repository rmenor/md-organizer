# Responsive Library and Reader Specification

## Purpose

Define responsive, touch-friendly library and reader behavior while preserving desktop behavior and the existing vanilla frontend architecture.

## ADDED Requirements

### Requirement: Responsive library navigation and minimalism

The library MUST provide usable navigation on smartphone, tablet, and desktop widths following a clean, square geometric aesthetic (zero border-radius). The main publications view MUST feature "Libros" directly without extraneous sections. When entering the book view, breadcrumbs and the upload ZIP button MUST be omitted for a clean reading catalogue. On mobile viewports (<768px), book items MUST be displayed in a strict 2-column grid.

#### Scenario: Mobile 2-column book grid

- GIVEN a smartphone viewport below 768px
- WHEN the user views the books catalogue
- THEN books are displayed in a 2-column grid (`repeat(2, 1fr)`)
- AND book cards are minimalist, emphasizing cover art and title with square geometry.

#### Scenario: Clean book view without breadcrumbs or upload button

- GIVEN the user navigates into the books publication view
- WHEN the view renders
- THEN no breadcrumb or upload ZIP button is displayed in the toolbar
- AND only relevant return/navigation actions and books are visible.


### Requirement: Compact search and responsive upload

Search and ZIP upload MUST remain available with touch targets of at least 44 CSS pixels, keyboard access, clear validation, and the existing `/api/search` and `/api/upload` contracts.

#### Scenario: Mobile search

- GIVEN a smartphone viewport
- WHEN the user opens compact search and enters a query
- THEN results use the same search endpoint and render without horizontal overflow
- AND clearing search restores the library.

#### Scenario: Upload failure and conflict

- GIVEN a selected non-ZIP file, invalid ZIP, or version conflict
- WHEN upload is attempted
- THEN the sheet keeps an actionable error/warning, restores controls, and does not discard the library view.

### Requirement: Full-width reader with mobile TOC

The reader MUST use the available mobile width, expose a touch-friendly TOC drawer, provide large previous/next chapter controls, and retain desktop TOC behavior.

#### Scenario: Read and change chapters

- GIVEN a book with one or more chapters is open
- WHEN the user opens the TOC, selects a chapter, or activates previous/next
- THEN the active chapter, progress label, content, and button disabled state stay synchronized
- AND the reader scrolls to the chapter start.

#### Scenario: Reader controls and fallback

- GIVEN the reader is initialized with the current HTML controls
- WHEN the user changes theme or font size
- THEN the visible `.theme-pill` and reader content scroll container are updated without exceptions
- AND keyboard activation produces the same result as touch.

### Requirement: Responsive accessibility and desktop preservation

Interactive controls MUST have accessible names, visible focus states, semantic expanded/pressed state where applicable, and a reduced-motion path. Desktop layout, endpoint behavior, and book-processing behavior MUST remain compatible.

#### Scenario: Reduced motion and desktop smoke path

- GIVEN a user prefers reduced motion or uses a desktop viewport
- WHEN they open/close overlays and read a book
- THEN transitions are reduced or disabled and the existing desktop sidebar, centered sheets, and reader layout remain usable.

### Requirement: Cohesive accessible color system

The interface MUST use a harmonious, role-based color system that preserves existing visual identity where possible. All surface, text, accent, interactive, overlay, and code-block colors MUST resolve through centralized CSS custom properties with light and dark theme values. Hover, focus, active, and disabled states MUST remain distinguishable and visually related to their base role. Normal text MUST meet at least 4.5:1 contrast, large text at least 3:1, and meaningful control boundaries/focus indicators at least 3:1 against adjacent colors.

#### Scenario: Theme and state consistency

- GIVEN the library or reader is rendered in either supported theme
- WHEN the user hovers, focuses, activates, or disables a control
- THEN the state uses the corresponding token family, remains distinguishable, and does not introduce an unrelated one-off color

#### Scenario: Mobile and overlay readability

- GIVEN a 375px or 768px viewport with a light or dark theme
- WHEN the user opens a touch control, modal, drawer, or code block
- THEN text, controls, boundaries, and focus indicators meet the stated contrast thresholds and remain readable against their immediate surface
