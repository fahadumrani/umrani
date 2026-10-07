# Native Banner fix — v60 / 1.3.3

## Confirmed compatibility problem
The owner supplied the official Native Banner embed and a screenshot showing Approved `umrani.devs.li` / Active NativeBanner_1. The provided script URL and container ID matched the earlier project.

In an isolated browser profile with diagnostic HTML intercepted at the approved origin, the opaque-origin iframe remained empty and raised:

```text
Failed to read the 'cookie' property from 'Document': The document is sandboxed and lacks the 'allow-same-origin' flag.
```

The same official direct tag rendered two creative/link roots in that comparison. This confirms a compatibility failure in the previous sandbox integration; a longer timer alone cannot restore cookie access.

## Explicit security decision
The owner selected **Direct embed — script gets page/storage access** after the trade-off was explained. The current Native Banner runs as ordinary page JavaScript and can access page content, cookies, localStorage and IndexedDB. It is NOT an isolated sandbox and is not described as one. Same-origin scripts+same-origin iframe flags were not used as a misleading safety substitute.

## Implementation
- Keep the exact official URL `https://bauval.org/21/63ea484e1a293480518c8d527b5e81e3` and container `container-63ea484e1a293480518c8d527b5e81e3`.
- Set `async` and `data-cfasync="false"` on one dynamic tag after the first successful complete reply.
- Preserve the container and rendered content across SPA/chat rerenders. Later replies may reveal the cached placement, not repeatedly inject the same tag.
- Respect explicit Close. No auto-clicks, popunder/social-bar tags or forced impression refresh loops are added.
- Replace the eight-second hide with a 30-second loading/no-fill timeout; keep observing for a late creative. A late result cannot override an explicit Close. Genuine script-load errors may retry after a later completed reply.
- Explicitly allow `bauval.org` for scripts/API in the parent CSP; allow HTTPS creative images/media/frames. Rendering CDN scripts retain SRI and the script policy does not allow arbitrary HTTPS script origins.
- The previous guarded `ads.html` and `vendor/ad-frame-loader.js` remain unused legacy files. The active app never navigates to or embeds them.
- Original API configuration, logo/icon assets, light-default theme and the v59 graph/rate/Markdown/focus/search/streaming behavior are preserved.

## Verification and honest limits
74 unit tests and seven offline browser suites passed. New tests cover official attributes, single load, close/reopen/rerender retention, slow response beyond eight seconds, no-fill, late recovery, script blocking and mobile overflow. See test-results.txt.

The direct official-tag compatibility probe rendered actual creatives. A separate full-build remote probe encountered `ERR_TUNNEL_CONNECTION_FAILED` before the ad script loaded; therefore the full build's production fill is not certified by that probe. Network/privacy extensions, provider fill/capping and regional policy can still prevent ads. Do not click your own ads as a test.

No new ZIP has been deployed automatically to the hosted website.

## Deploy
Upload the contents of the ZIP's `umrani/` folder into the existing GitHub repository root. Replace index.html, dist/, styles/ and the supplied source/docs/tests; retain .nojekyll and existing custom-domain/CNAME settings. No app backend or local server is required. After GitHub Pages finishes, hard-refresh and verify both main assets load with `?v=60`.

Test with one ordinary completed chat reply, wait for the placement, and check Network/Console if absent. An HTTP 200 script alone does not prove a creative rendered. Do not repeatedly reload or click ads to manufacture traffic.

## Changed/new files since v59
- `README.md`
- `dist/app.bundle.js`
- `docs/native-ads-v60.md`
- `docs/search-and-graphs.md`
- `docs/test-results.txt`
- `index.html`
- `package.json`
- `scripts/test-browser.mjs`
- `scripts/test-direct-ads.mjs`
- `scripts/test-file-mode.mjs`
- `scripts/test-live-bugfix.mjs`
- `src/main.js`
- `src/ui/ads.js`
- `styles/main.css`
- `tests/api/security.test.mjs`
- `tests/ui/direct-ads.test.mjs`
- `tests/ui/structure.test.mjs`
