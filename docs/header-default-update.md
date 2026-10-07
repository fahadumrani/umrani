# Matching Umrani AI text and light default

- Replaced the small AI badge with plain **Umrani AI** text in the top-left header and sidebar. Both words inherit one font, size, weight and baseline. The header uses its existing 16px/700 styling; the sidebar keeps its existing brand-label styling. Mobile visibility is preserved.
- Light mode is now the default regardless of the browser/device color preference. Removed the automatic dark preference media query. Explicit dark root selectors remain available; no toggle or JavaScript change was added.
- Refreshed the stylesheet cache version to v=56. Modern icons, logo colors, links and all app behavior are unchanged.
- Build/preservation check: every runtime source JS file, bundle and icon asset is byte-identical to the preceding delivered project.

Changed: `index.html`, `styles/main.css`, `styles/variables.css`, relevant header/theme regression assertions and documentation. No dependencies or hosting platforms added.

QA: 60 unit tests; 25 existing browser/file regression groups; 8 theme viewport groups covering both OS preferences, default light rendering, explicit dark selectors and widths 1280, 768, 390 and 320. The header text is checked visible at every size. Visual review covers the desktop/mobile matching header and retained dark styling. Tests mock AI/data responses; no production deployment or live provider availability check is implied.

For GitHub Pages, upload the contents of the extracted `umrani` folder to the repository root. No backend is required for these changes.


## Subsequent reference-layout release

This document records an earlier update. See `reference-layout.md` for the current composer/footer, sidebar and functional reply-action changes and latest QA.
