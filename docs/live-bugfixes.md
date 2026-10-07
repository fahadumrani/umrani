# Live-review bug fixes — Umrani 1.3.2 / v59

## Changes
1. **Incorrect fractional graphs:** a bounded polynomial parser consumes the full expression. Constant division, implicit multiplication and parentheses are supported. It never runs user/AI strings as JavaScript. `x²/2` gives `0.5x²`; unsupported functions/ranges are rejected clearly.
2. **Small-range graph labels:** precision is based on the tick step, and y padding is relative to actual values instead of a fixed minimum of 1. Nonfinite geometry is rejected.
3. **Historical/future rates:** these intents cannot call the current-feed shortcut. The app explains that historical/future rates are unavailable instead of replacing them with today's number. Current rates remain indicative, timestamped and sourced.
4. **Mobile focus escaping:** covered body siblings become inert while the drawer is modal. Capture-phase Tab handling survives nested chat-delete key handlers, wraps both ways and restores focus. Desktop behavior is retained. Delete-confirmation text labels its dialog.
5. **Raw Markdown link syntax:** safe DOM tokenization renders labelled HTTP(S)/mailto links before bare URL auto-linking; parentheses in ordinary URLs are supported. Unsafe schemes/HTML/code-span links remain inert.
6. **Blank advertisements:** the isolated loader observes creative elements, sends per-frame status, and times out on no-fill/errors. The parent verifies the actual frame WindowProxy, null origin and channel. Blank/error shells are removed without locking the composer; a later completed reply can retry. Manual close cancels delivery. No ad auto-clicks, popunders or same-origin privileges were added.
7. **Inconsistent explicit Wikipedia requests:** requests such as “Search Wikipedia for Pakistan and give a brief summary with a source” search the topic, then display bounded retrieved excerpts directly. The model cannot replace that explicit lookup with a browsing refusal. Stop cancels the request. Ordinary chat still receives limited relevant context.

## What is preserved
- Original browser API configuration/keys, logo and icon assets, developer URL, Umrani AI branding, default light mode and existing responsive theme.
- The previous v58 streaming-continuity fixes and IndexedDB history migration.
- GitHub Pages-only static hosting, relative assets and the ready-built bundle; no backend, proxy or other hosting account was introduced.

## Verification
- 71 unit tests passed; syntax checks passed.
- Six local browser suites passed: general behavior, new live-bug cases, streaming continuity, reference layout/reply actions, light/dark responsive themes and file-open mode. See test-results.txt.
- Theme QA covers 1920, 1280, 768, 390 and 320px widths in both themes. New drawer regressions cover 390/768px; repository-subpath static serving is covered.
- Browser calls are intercepted/mocked; tests do not send credentials to production AI or generate live ad clicks/impressions.

## Honest limits
- This is **Wikipedia encyclopedia lookup**, not full-web Google/Bing/news search. GitHub Pages does not provide an application search backend.
- Historical currency records and exchange-rate predictions are not implemented; these questions now receive an explicit limitation, not the wrong current rate.
- A provider must still supply a real ad creative and allow the deployed domain/browser. No-fill/blocked inventory is not something frontend code can force to display. HTTP 200 alone is not considered a filled creative. Nested cross-origin ad contents cannot be fully inspected by the parent.
- The mutable ad network remains in an opaque-origin `allow-scripts` frame. This intentionally restricts some network behavior and may require provider-supported sandbox compatibility; it is not bypassed to make ads appear.
- Browser-side API keys remain public by the owner's choice. The release does not certify live key validity/provider CORS/quota or claim the entire project is free of every possible bug.
- This ZIP was tested locally and has not been deployed to umrani.devs.li.

## Deployment
Extract the ZIP and upload the contents of `umrani/` to the existing repository root, including `index.html`, `ads.html`, `dist/`, `styles/`, `assets/`, `vendor/` and `.nojekyll`. Keep any existing custom-domain/CNAME setting for umrani.devs.li. Use your existing GitHub Pages deployment, then hard-refresh once it completes. Source files/tests/docs are included for maintainers; no build is required for the supplied prebuilt assets.

## Changed/new files in this release
- `README.md`
- `ads.html`
- `dist/app.bundle.js`
- `docs/live-bugfixes.md`
- `docs/search-and-graphs.md`
- `docs/test-results.txt`
- `index.html`
- `package.json`
- `scripts/test-browser.mjs`
- `scripts/test-live-bugfix.mjs`
- `src/api/live.js`
- `src/main.js`
- `src/ui/plot.js`
- `src/utils/formatter.js`
- `styles/main.css`
- `tests/api/live-bugfix.test.mjs`
- `tests/api/live-plot.test.mjs`
- `tests/ui/structure.test.mjs`
- `vendor/ad-frame-loader.js`
