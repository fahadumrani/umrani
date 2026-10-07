# Umrani — GitHub Pages edition (1.3.2)

**Static frontend. No application server, localhost launcher, Cloudflare, Vercel, Netlify or `.env` setup required.** The browser-ready bundle is included.

## Deploy — no local build needed

1. Extract this ZIP. Upload the **contents inside `umrani/`** to your repository root, so `index.html` is at the root. Do not upload only the ZIP or nest the complete project under another folder.
2. In GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**.
3. Select your `main` (or `master`) branch and **`/ (root)`**, then Save.
4. Wait for GitHub's Pages deployment. Open the Pages URL shown in Settings; refresh with Ctrl+F5 if an older build is cached.

Both `https://USERNAME.github.io/` and `https://USERNAME.github.io/REPOSITORY/` are supported with relative asset URLs. `.nojekyll` is included. The old `CNAME` was removed so an unrelated/custom domain does not override your default GitHub Pages URL. Add a correct CNAME later only if you actually configure your own domain.

An **optional manual-only** `.github/workflows/pages.yml` is included. Use it only if you choose **GitHub Actions** as the Pages source, then run “Deploy Umrani to GitHub Pages” under Actions. The usual branch deployment above does not need that workflow. It is manual-only to avoid failed/duplicate Actions deployments before Pages is configured.

## What works

- Browser-side chat and account/model fallback, with a total 90-second request budget and bounded attempts.
- Current date from the user's device clock/timezone, also supplied freshly to model requests.
- Timestamped USD/PKR **indicative reference rates**, including the reciprocal conversion and a source link. These are not bank/open-market buy/sell quotes. Stale or failed data is not replaced with an old model rate.
- **Automatic Wikipedia public lookup** in the browser (English/Urdu), including readable article excerpts and source URLs. No local API/proxy or new search key is required.
- Safe mathematical **quadratic/parabola** graphs with numeric axes and a computed vertex. Unqualified requests explicitly assume y=x²; valid simple polynomial equations can be parsed locally. Unsupported functions are not silently turned into fake Mermaid charts.
- Mermaid structural diagrams, KaTeX math, text/code attachments, Urdu directionality, local history, voice input and isolated ads.
- Slim horizontal composer with attachment, voice and send/Stop controls. “Umrani 2.1” and Deep Think now sit in the footer below it, matching the latest reference.
- Persistent/collapsible desktop sidebar, mobile drawer, neutral user bubbles and open editorial AI replies.
- Reply copy, browser read-aloud, local helpful/unhelpful feedback and safe latest-reply regeneration.

### Search scope — important

**This is encyclopedia lookup, not full Google/Bing search, live-news crawling or arbitrary webpage browsing.** The model context and documentation clearly say so. A retrieval timestamp does not prove an article is current. Currency questions use a separate timestamped live reference feed; date questions use the device clock.

Without a browser-compatible search API/provider or a proxy, GitHub Pages alone cannot provide reliable full-web search. This release does **not** claim to implement it. If public lookup fails due to network/CORS/availability/rate limits or no results, the app says no evidence was retrieved and avoids invented current facts.

External data requests still go to existing public services: Dahl for AI, Wikipedia for article lookup, the currency feed, rendering CDNs and the isolated ad network. “GitHub-only hosting” does not make those public services run inside GitHub.

## Original API keys

All ten original AI account keys are intentionally preserved in `src/config/config.js` and the generated browser bundle, per the owner's request. **Anyone who can read the repository or app bundle can copy/use them and consume quota.** CSP/SRI cannot make frontend keys secret. Their validity and the provider's allowed CORS origins/models were not verified with live AI calls.

## Security and history

- Main-page CSP meta policy and pinned SHA-384 SRI rendering dependencies. GitHub Pages cannot add arbitrary CSP/anti-framing headers; no server-only header protections are claimed.
- Strict Mermaid mode plus explicit SVG sanitization; complete diagrams render in a contained temporary host, and failure DOM is cleaned up. Incomplete streaming fences are not sent to Mermaid.
- Ads run in an iframe with `sandbox="allow-scripts"` and an opaque origin, never `allow-same-origin`. The static ad loader refuses top-level/non-opaque execution, protecting direct visits to `ads.html` without a server sandbox header. Live ad compatibility/network policy still needs review.
- IndexedDB version 2 splits metadata/messages and migrates existing history in place. Unchanged attachments are not repeatedly written. Deletes cascade; saves/deletes resolve after commit. The physical `BolanAI` identifier is retained so existing history remains available.
- The newest message/file is rejected if it cannot fit the conservative context budget; saved older history is not deleted. A 3 MiB selectable file is not guaranteed to fit a model request.
- Avoid editing the same chat simultaneously in several tabs; cross-tab conflict resolution is not implemented. Keep device time accurate for date/feed-freshness checks.

## Optional development/QA only

Node.js is **not required to host/use the prebuilt app on GitHub Pages**. Maintainers can use Node 22+ to rebuild/test:

```sh
npm run build
npm run test:syntax
npm test
```

The build produces the single `dist/app.bundle.js` and synchronizes CSS tokens into the main stylesheet. Edit `src/` and `styles/variables.css`, not generated bundle/tokens. Update asset cache versions for releases.

Optional browser regressions:

```sh
npm install
npx playwright install chromium
npm run test:browser
npm run test:file
```

The browser test script uses a temporary **test-only static fixture** under a repository subpath, not an app backend. It has no API routes. Mock AI/currency/public-lookup responses prevent use of live account credentials. Rendering assets require network access unless `QA_ASSET_DIR` provides `katex.min.js`, `auto-render.min.js`, `katex.min.css`, `mermaid.min.js` and `purify.min.js`. Screenshots go under `.qa/` or `QA_OUTPUT_DIR`.

See `docs/fixes.md` for results and remaining limits.

## Editorial light/dark theme

The UI now uses warm neutral surfaces, serif headings and a restrained clay accent; Umrani brand colors and app behavior are preserved; icon glyphs have been refreshed. Light mode is the default, including on devices that prefer dark mode. Root attributes `data-mode="dark"` / `data-theme="dark"` or class `dark` are also supported; Dark mode is opt-in through the supported root selectors. No extra font service or theme-toggle dependency is required.

`styles/variables.css` owns palette/font tokens; `styles/main.css` owns component rules. Run `npm run build` after editing tokens. Optional visual regressions: `npm run test:theme`. Full changed-file list, viewport matrix and limitations: `docs/theme-qa.md`.

## Umrani AI header and modern icons

The desktop/mobile header and sidebar now show **Umrani AI**. All interface icons use a local rounded SVG system, including the refreshed favicon and matching Deep Think/code-action icons. No icon CDN is required. Edit `src/ui/icons.js`, then run `npm run build` to regenerate standalone assets, inline icons and the app bundle together. Details and QA: `docs/icons-update.md`.

### Header and default theme

**Umrani AI** is plain matching text in the header/sidebar, not a smaller AI badge. Light mode is the default regardless of the device theme. Explicit dark selectors remain supported. Latest checks: `docs/header-default-update.md`.

## Latest reference-layout update

The latest supplied screenshots guide the layout, while retaining Umrani AI branding and a light default. The marked Greeting dropdown, Share control and account/profile footer were deliberately not added. The existing About Developer link and Search Chats remain. No Claude branding, fake model choices or unsupported voice-mode controls are introduced.

Reply actions are functional, not decorative: feedback stays in local chat history; read-aloud depends on browser speech support; regeneration preserves the previous answer on failure or Stop and never consumes an unsent draft. The existing public encyclopedia lookup, currency feed and provider configuration are unchanged.

Run `npm run test:reference` for these interactions. Latest changed files, test scope and limitations: `docs/reference-layout.md`. Earlier theme/icon/header QA documents describe their respective historical updates.

## Streaming-continuity fix (preserved from v58)

Initial answer text is no longer automatically erased/restarted by a provider fallback after output has begun. A broken stream keeps the partial reply with an explicit interruption notice; use Regenerate to try again. Pre-answer fallback still works. Late thinking-only events cannot blank an existing answer, and final AI reply rerenders do not replay an opacity-zero animation.

Run `npm run test:streaming` for the new mocked cases. See `docs/streaming-fix.md` for behavior changes, verification and remaining audit limits. This release fixes the reported continuity path; it does not claim every audit finding is resolved.

## Live-website bug fixes (v59 assets / 1.3.2)

- Fractional and parenthesized quadratic expressions are parsed as bounded polynomial arithmetic: `plot y=x^2/2`, `plot y=(x-2)^2`, `plot y=1/2*x^2+3/4*x-1/8`. No `eval`/generated executable code. Unsupported expressions receive a clear error, never a silently changed equation.
- Plot axes use range-aware precision and scale padding; small ranges no longer label every tick zero. Nonfinite/tiny unsafe geometry is rejected explicitly.
- Historical/future currency requests do not receive the latest feed as an answer. Historical lookup is not implemented: the app clearly explains that limit and links to SBP records. Current indicative rates retain their source and timestamp.
- Labelled HTTP(S)/mailto Markdown links render as links, including ordinary parenthesized URL paths. Code spans and unsafe protocols remain inert.
- Mobile/tablet drawer focus is contained; covered background controls are inert. Escape/close restores focus. Desktop sidebar behavior is retained. Delete dialogs have an accessible label.
- Explicit Wikipedia requests extract the topic and return the retrieved excerpts/source directly instead of allowing a model to claim it cannot browse. Ordinary chat can still use bounded excerpts. Stop aborts the lookup. This remains encyclopedia lookup, **not full-web/live-news search**.
- Ads have loading/rendered/error/no-fill states. Failed/no-fill requests remove the empty shell; a later completed reply can try again. Parent messages are checked against the actual iframe and per-frame channel. The script URL, container ID and opaque-origin sandbox are preserved. **Actual ad inventory, approved domain and provider compatibility remain external dependencies; this release does not guarantee paid ads will fill.**

Prebuilt v59 assets are included. No backend or new hosting platform is required. Do not add `.env` or a localhost server to deploy this app. Original browser API keys remain unchanged and public as requested.

Run `npm run test:livebugs` for the new mock-only browser regressions. See `docs/live-bugfixes.md` and `docs/test-results.txt` for verification and limits.
