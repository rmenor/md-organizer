# Tasks: Mobile-First Library and Integrated Wiki

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 500–750 implementation/test lines |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR #1 API/source wiring → PR #2 responsive UI/reader → PR #3 tests/manual polish |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Add Wiki contract and dynamic render shell | PR #1 | Base = feature/tracker branch; tests included. |
| 2 | Complete responsive navigation, reader, upload, and accessibility | PR #2 | Base = PR #1 branch; preserve desktop breakpoint behavior. |
| 3 | Regression tests, manual verification, and cleanup | PR #3 | Base = PR #2 branch; tracker branch is the integration target. |

## Phase 1: Wiki Foundation

- [x] 1.1 Add `GET /api/wiki` in `server.js` with fixed source path, `{content, source}` success contract, and generic failure response.
- [x] 1.2 Promote Guía & Wiki to primary section view (`#wiki-view`) in `public/index.html` with subtab coordination, replacing the obsolete modal dialog.
- [x] 1.3 Implement source loading, safe Markdown rendering, short fallback, loading/error states, and copy behavior in `public/js/app.js`.

## Phase 2: Responsive Interaction and Color System

- [x] 2.1 Refine `public/css/styles.css` for phone/tablet navigation, off-canvas/sidebar states, full-width reader, TOC drawer, large chapter controls, sheets, focus, safe areas, and reduced motion.
- [x] 2.2 Centralize surface, text, accent, interactive, overlay, and code-block colors in CSS custom properties for both existing light/dark themes; preserve identity colors where readable and define harmonious hover/focus/active/disabled variants.
- [x] 2.3 Update `public/js/app.js` to coordinate overlays, Escape/focus behavior, compact search, touch upload selection, backdrop, and keyboard fallback.
- [x] 2.4 Fix `public/js/reader.js` selectors and scroll target; synchronize TOC, theme, font, chapter navigation, and reader lifecycle.
- [x] 2.5 Transition Guía & Wiki to primary application view with topbar title switching ("Guía"), subtabs bar, and back-to-grid navigation.

## Phase 3: Verification

- [ ] 3.1 Extend `tests/test_app.js` for Wiki success/error contracts without changing database or ZIP-processing semantics.
- [ ] 3.2 Run `npm test` and manual smoke checks at 375px, 768px, and desktop widths for search, upload/conflict, Wiki, reader, keyboard, and touch flows.
- [ ] 3.3 Verify both themes use only the color tokens, meet 4.5:1 normal-text / 3:1 large-text and control-boundary contrast thresholds, and keep touch controls plus modal/drawer/code content readable.
- [ ] 3.4 Verify no horizontal overflow, unsafe Wiki HTML execution, dead overlay state, or desktop regression; record any browser-specific follow-up.
