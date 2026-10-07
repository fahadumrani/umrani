# Editorial theme update

This records the earlier theme-only update. The subsequent requested icon/header refresh is documented in `docs/icons-update.md`; icon geometry and presentation rendering have since changed intentionally. The latest light-default/header behavior is recorded in `docs/header-default-update.md`.

## Changed files

- `styles/variables.css`: exact requested light/dark tokens, safe local font fallbacks, brand-only color tokens, system dark preference and explicit dark selectors.
- `styles/main.css`: generated token region plus editorial component styling and responsive rules. Original logo gradients, icon geometry and dimensions are retained.
- `index.html`: stylesheet cache version only (`v=54`). Text, markup, links, labels and ARIA attributes are unchanged.
- `package.json`: optional `test:theme` command; no added dependencies.
- `scripts/test-theme.mjs`: mock-only theme, state and viewport checks.
- `tests/ui/structure.test.mjs`: update obsolete code-color assertions for the requested theme.
- `tests/ui/theme.test.mjs`: three theme regression checks.
- `README.md`: theme usage and optional QA guidance.
- `docs/theme-qa.md`: this change/QA record.
- `docs/test-results.txt`: latest regression results.

## Visual changes

Flat warm neutral surfaces, near-black light-mode copy, warm off-white dark-mode copy, serif editorial headings, sans-serif body/controls, soft borders, restrained clay focus/active/underline accents, neutral chat bubbles and a compact elevated composer. Desktop content is capped at 1150px. The input still starts at 44px and auto-grows with the unchanged JavaScript. Model and Deep Think controls stay inside it. At narrow widths the existing bottom row wraps rather than overflowing.

The unchanged brand marks are the only remaining purple/teal gradients. Serif styling applies to the existing empty-state heading; navigation brand labels retain their existing size/weight. No font downloads were added.

## Dark mode

Follows the device/browser color preference automatically. Existing theme selector conventions are supported on the document root: `data-mode="dark"`, `data-theme="dark"`, or class `dark`. Setting either attribute to `light` overrides the system preference. No new toggle, text or JavaScript behavior was added.

Main/background: #151515; sidebar: #0B0B0B; cards/composer/code: #20201F. Borders use white alpha. Code headers use #292927. Mermaid's rendered flowchart labels, nodes and arrows receive theme-aware CSS; its renderer/sanitizer are unchanged.

## Preservation checks

SHA-256 comparisons against the input project confirm that every application source JavaScript file, the generated app bundle, vendor scripts, ad document and all logo/assets are byte-identical. `index.html` differs only by the stylesheet cache version. Browser checks confirm the original logo dimensions and colors in both themes. Existing model/account keys and provider configuration were not changed.

## QA results

- Syntax checks: passed.
- Unit tests: **55 passed, 0 failed** (52 existing plus 3 theme tests).
- Existing browser regression groups: **21 passed**.
- Existing direct-file regression groups: **4 passed**.
- Theme viewport groups: **8 passed**:

| Viewport | Light | Dark |
| --- | --- | --- |
| 1280 x 720 | Pass | Pass |
| 768 x 1024 | Pass | Pass |
| 390 x 844 | Pass | Pass |
| 320 x 740 | Pass | Pass |

Each theme group checks empty state, chat/code, sidebar, Urdu/RTL, attachment, flowchart diagram, ad shell, streaming/stop state, loading screen, error/confirmation dialog, clay input focus and Deep Think aria-pressed behavior. Document horizontal overflow and uncaught JavaScript errors: none in these checks. System preference and all three explicit dark selectors were verified. Flowchart SVG bounds are asserted so all nodes fit its viewBox.

Visual review found and repaired a reduced-motion issue: the old universal nonzero transition duration enabled SVG transform interpolation during Mermaid measurement, producing a clipped diagram. Reduced-motion transitions are now disabled, and the off-screen Mermaid measurement host cannot animate. The fix is CSS-only.

Screenshots were reviewed at delivery sizes for light/dark desktop, mobile, drawer, empty state, code/RTL/diagram/ads, error/confirmation and loading states. Script-free frozen DOM previews were also rendered at 1280 x 720 with no missing resources, browser exceptions or viewport overflow.

### Contrast choices

Representative text contrast ratios: light primary/page 19.17:1; light secondary/page 7.73:1; dark primary/page 15.88:1; dark secondary/card 9.10:1. Requested clay on white is only 3.12:1, so links use readable primary text with clay underlines, and small helpers/controls use secondary text rather than low-contrast muted/clay text. Clay remains the focus/indicator color. This is targeted QA, not a complete WCAG certification.

### Scope and remaining limits

Tests use mocked AI/data requests and block live ad-network calls. The ad shell was checked; third-party creative styling inside its sandbox is outside the host page's CSS. No live provider availability, account validity or production GitHub deployment was tested. The GitHub-Pages-only architecture, browser-visible keys, upstream CORS dependencies and existing limited public-encyclopedia lookup are unchanged. This visual update does not add a full-web/news search service or claim that all possible bugs are eliminated.

## Re-run

```sh
npm run build
npm run test:syntax
npm test
npm run test:browser
npm run test:file
npm run test:theme
```

Browser tests require installed Playwright/Chromium. Set `CHROMIUM_PATH` when using another installed Chromium; optionally supply pinned rendering assets via `QA_ASSET_DIR`. These are development-only checks, not hosting requirements. Upload the complete project contents to the GitHub Pages repository root; no additional platform/backend is required for this theme.


## Subsequent reference-layout release

This document records an earlier update. See `reference-layout.md` for the current composer/footer, sidebar and functional reply-action changes and latest QA.
