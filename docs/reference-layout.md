# Reference-layout release

## Scope and visual changes

- Match the supplied open/collapsed-sidebar reference using Umrani AI branding, without the marked Greeting dropdown, Share button or account/profile footer. No Claude brand/model labels or fake waveform voice mode.
- Plain matching-font “Umrani AI” text in sidebar/header. Light is the default even when the OS prefers dark. Explicit dark selectors continue to work. Existing logo vector assets, their colors, developer link and provider keys/configuration are unchanged by this update.
- Persistent desktop sidebar above 900px, collapsible without an overlay. Smaller screens use the existing modal drawer. Search Chats and local history remain. Closing restores focus to the menu; controls expose expanded/hidden state.
- Neutral light-gray user bubbles; open, borderless serif AI replies; clean sans-serif controls and monospace code; wide whitespace and subtle warm-neutral surfaces.
- Slim horizontal composer: attachment plus, auto-growing input, mic and send/Stop. Actual Umrani 2.1 and Deep Think controls are below the composer now, superseding the earlier inside-card layout. Mobile footer stacks safely.
- Consistent local vector reply icons, theme-aware surfaces and visible clay focus states. Icon targets remain 44px.

## Reply actions

- Copy uses the existing clipboard helper with temporary confirmation.
- Read aloud starts only after a click, uses browser SpeechSynthesis and supports stop. Voice/language availability depends on the user's browser/device; unsupported browsers get a message.
- Helpful/unhelpful feedback is mutually exclusive and stored only in local IndexedDB chat history. It is not sent to a training/feedback service.
- Regenerate acts only on the latest saved assistant reply. It reuses the saved user turn/attachment without adding a duplicate user message, preserves an unsent draft, and restores the previous answer if the request fails or is stopped. It is disabled for older replies and during generation.

## Files changed in this release

- `index.html`: reference structure, composer footer, sidebar accessibility and cache versions.
- `styles/main.css`: responsive reference-layout rules, reply actions and component styles.
- `src/main.js`: sidebar state/focus, reply actions, safe regeneration integration.
- `src/ui/reply-actions.js`: functional accessible reply toolbar.
- `src/ui/icons.js` and generated `assets/icons/plus.svg`, `volume.svg`, `thumbUp.svg`, `thumbDown.svg`, `regenerate.svg`: five additional local glyphs.
- `dist/app.bundle.js`: rebuilt browser-ready bundle.
- `package.json`, `scripts/test-reference.mjs`, `scripts/test-browser.mjs`, `scripts/test-file-mode.mjs`, `scripts/test-theme.mjs`, `tests/ui/reference.test.mjs`: regression coverage and updated layout expectations.
- `README.md`, `docs/reference-layout.md`, `docs/test-results.txt` and notes in earlier theme/icon/header QA documents.

## Verification

- 63 unit tests passed; syntax checks passed.
- 25 existing browser/file-mode regression groups passed.
- 10 light/dark viewport groups passed at 1920×900, 1280×720, 768×1024, 390×844 and 320×740. Checks include sidebar, empty state, chat, RTL, code, Mermaid, ads shell, attachment, loading, errors, focus and Deep Think. No horizontal overflow in those checks.
- 6 reference interaction groups passed: clipboard/speech actions, feedback persistence, regeneration, draft guard, failed regeneration, Stop recovery and responsive sidebar/focus behavior. No uncaught errors in these checks.
- Manually inspected expanded/collapsed wide desktop, mobile, drawer, dark desktop, code reply, dark RTL/diagram/ad/streaming state, empty state, error dialog and dark startup loading screenshots. Preview fixtures contain demo conversations only; no sample chats are seeded in the shipped app.

Tests use a temporary static fixture and mocked provider/currency/lookup/clipboard/speech responses, not a production backend. They do not establish live AI credentials, provider CORS/model availability, real news retrieval, browser voice quality or live ad creative compatibility. Search remains public Wikipedia lookup plus a separate currency feed, not unrestricted full-web search. The existing security/privacy limits documented in README remain.

## Deployment

The ZIP includes the prebuilt bundle, local icons and `.nojekyll`. Upload the contents of `umrani/` to the repository root and use GitHub Pages branch/root deployment. No server, localhost launcher or additional hosting platform is needed. Relative URLs support repository-subpath hosting.
