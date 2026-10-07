# Umrani AI header and modern icons

Historical icon-refresh record. The later matching-text and light-default changes are documented in `docs/header-default-update.md`.

## Changes

- Top-left header and sidebar now read **Umrani AI**, using a compact theme-aware AI badge. The header remains visible on mobile.
- Refresh all existing static/dynamic UI glyphs with a local, rounded 24px-grid SVG system: menu, close, new chat, search, attach, mic, send, stop, developer, brain, trash, copy, check, download, expand, collapse, file and brand.
- Refresh the favicon/brand glyph while retaining the existing brand colors and icon container dimensions. This intentionally supersedes the earlier request to leave icon geometry unchanged.
- Replace Deep Think/attachment emoji and close text glyphs with predictable theme-aware SVGs. Retain readable text labels, aria labels, pressed state and existing handlers.
- Copy/download/expand state changes preserve their icons instead of reverting to text-only controls.
- No icon font, remote icon library, new service or hosting dependency.

## Source and files

`src/ui/icons.js` owns all 18 outline glyphs and safe icon+label rendering. `scripts/build-icons.mjs`, run by `npm run build`, generates 18 individual SVG files plus `assets/icons/umrani-mark.svg` and synchronizes marked inline HTML SVGs. The app bundle is regenerated from source.

Updated: `index.html`, `styles/main.css`, presentation-only rendering in `src/main.js`, `scripts/build.mjs`, `dist/app.bundle.js`, favicon, README and QA documentation. Added icon source/generator, standalone SVG assets and `tests/ui/icons.test.mjs`. Browser/theme assertions were updated to distinguish decorative icons from diagram SVGs and verify the mobile AI header.

## Preservation

The API, model/provider configuration, keys, search/data retrieval, prompts, streaming/fallback budgets, graph calculation, persistence, voice handling and ad sandbox remain unchanged. The changes in application JavaScript are confined to SVG/icon-label rendering and its import. Existing U-brand identity and colors remain; glyph geometry is refined as requested. The editorial light/dark palette and compact composer are retained. No deployment was performed.

## QA

- Syntax checks passed.
- **59 unit tests passed** (including 4 new icon checks).
- **25 existing browser/direct-file regression groups passed**, with remote AI/data requests mocked.
- **8 theme viewport groups passed**: both light/dark at 1280x720, 768x1024, 390x844 and 320x740.
- Header visible on mobile; Deep Think's icon survives state changes; code action icons appear correctly; no document horizontal overflow or uncaught browser errors in the checked states.
- Standalone icons match the runtime source exactly; names, sizes and classes are validated. File/label text is inserted with `textContent`, not interpreted as SVG/HTML.
- Full icon gallery and updated desktop/mobile/drawer previews reviewed. Script-free desktop preview captures report no missing resources, exceptions or viewport overflow.

The invalid/partial Mermaid test now excludes decorative `.ui-icon` SVGs when checking that no diagram is rendered. It still asserts that malformed diagrams do not leak graphics or disturb layout.

These are mocked/local regression checks, not a guarantee of live upstream availability or every possible edge case. Existing GitHub-Pages-only search limitations are unchanged.

## Deploy and rebuild

Upload the **contents** of the extracted `umrani` directory to the repository root and use the existing GitHub Pages setup. The prebuilt project needs no server or build platform.

For maintainers: edit `src/ui/icons.js`, then run `npm run build`; the icon files, inline SVGs and app bundle are synchronized together. Run `npm test`, `npm run test:browser`, `npm run test:file` and `npm run test:theme` for QA. Browser test dependencies are development-only.


## Subsequent reference-layout release

This document records an earlier update. See `reference-layout.md` for the current composer/footer, sidebar and functional reply-action changes and latest QA.
