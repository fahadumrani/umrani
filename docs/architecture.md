# Static architecture

GitHub Pages serves `index.html`, `ads.html`, `dist/`, `styles/`, `assets/` and `vendor/`. No runtime server, serverless function, local proxy or environment file is part of this release.

`src/app.js` loads the coordinator in `src/main.js`; `scripts/build.mjs` generates one classic bundle and synchronizes design tokens. All deployed asset paths are relative, supporting repository subpaths.

The browser sends chat/probe requests directly to Dahl with the original embedded keys. Probes are account-aware and bounded. Completion retries share one deadline. Context uses conservative byte-based estimates and output reserves. JSON/SSE readers bound responses and safely reconstruct multiline events/UTF-8. The keys are public; no hidden credential storage is claimed.

`src/api/live.js` handles device date, a timestamped indicative currency feed and CORS-enabled Wikipedia article lookup. Lookup evidence is capped at 6,500 UTF-8 bytes and explicitly labeled as encyclopedia content, not full-web/live-news search. There is no `/api/search` dependency. Failed/empty public responses are surfaced as unavailable.

`src/ui/plot.js` validates numeric quadratic specifications and computes a curve/vertex without `eval`. Mermaid handles structural diagrams only. Complete non-streaming diagram blocks render into a fixed temporary host; sanitized SVG is inserted into message content and temporary failure DOM is removed.

IndexedDB stores metadata, individual messages and small app state. Version-1 history migrates atomically. Per-chat snapshots avoid rewriting unchanged attachments. Same-chat cross-tab editing can still be stale.

The compact composer has a 44px-minimum, 180px-maximum auto-growing textarea and one bottom row containing model/Deep Think controls and action buttons. Ads remain reusable through feed rerenders and are isolated in an opaque-origin sandbox. Their static loader refuses direct/non-opaque execution; only the iframe loads mutable network code.

`scripts/static-qa.mjs` is test infrastructure only, not an application server or production hosting requirement.
