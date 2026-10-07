# Debugging and fixes — GitHub Pages edition 1.3.1

## Current changes

- Removed the runtime Node server, search proxy, local launcher and environment setup.
- Replaced same-origin search with browser-compatible English/Urdu Wikipedia lookup, bounded excerpts and source URLs. Model context and documentation disclose encyclopedia-only scope and failure states.
- Added `.nojekyll`, removed the old unrelated CNAME, retained relative asset paths and included an optional manual GitHub Pages workflow.
- Original ten browser API keys remain unchanged in source and bundle; no live key requests were made during QA.
- Retained current-device date and timestamped USD/PKR indicative feed handling; no stale model rate is substituted for failed current evidence.
- Retained inside-card controls in a compact composer, inside-card model/Deep Think controls, safe quadratic plotting and Mermaid error isolation/partial-fence deferral.
- Added static-host ad-loader guards because GitHub Pages cannot send server sandbox headers.
- Public evidence is capped by UTF-8 bytes so long Urdu excerpts cannot overfill the configured system-context budget.
- Unit test discovery is cross-platform; Node is development-only, not a hosting/runtime dependency.

## Previous bug fixes preserved

Account-aware probes, shared request deadline, output/context budgets, oversized-current-message rejection, explicit SVG sanitization, heading levels, user RTL, locale-aware speech and streaming lock, confirmation click/focus fixes, attachment-read race protection, delta message storage/migration/commit handling, cascade deletion, JSON/SSE response limits, multiline/CRLF/UTF-8 parsing, small repeated token preservation, diagram cache whitespace/size guards, safe same-chat reply/ad routing, single reproducible bundle and CSS synchronization.

## Verification scope

- 52 automated tests passed after removing tests for deleted backend features and adding static-host/CORS/asset/security/context tests.
- 21 hosted-style browser regression groups passed under a **repository subpath**, with no app backend or API routes.
- 4 direct-file browser regression groups passed, including browser-only public lookup and explicit scope labeling.
- Syntax checks and reproducible JS/CSS generation passed.
- Public Wikipedia API was checked live: HTTP 200, CORS `*`, article results returned. Currency feed availability was checked in the preceding review. These are point-in-time checks, not uptime guarantees.
- AI, currency and lookup data in browser regressions were mocked; screenshot value 280.00 is a fixture, not a current-rate claim. Live AI keys, microphone recognition and ad delivery were not exercised.
- GitHub account/repository deployment was not performed; the ready-to-upload source, bundle and deployment instructions are supplied.

## Remaining limitations

Browser/repository keys are public. Full Google/Bing/live-news search is not implemented without an external search API/provider/proxy. Public lookup/feed and model endpoints depend on network/CORS/availability and quotas. Only quadratic plotting is supported. Device time may be wrong. Same-chat edits in multiple tabs can still be stale. GitHub Pages does not provide arbitrary HTTP security headers. Strict-sandbox ad compatibility needs live review. No claim of every possible bug being eliminated is made.

## Requested compact-input update

Textarea minimum reduced to 44px (grows to 180px); card max-width reduced to 780px and padding tightened. Model/Deep Think controls remain inside. The persistent “Search: Wikipedia lookup · Timestamped USD/PKR feed · Not full-web search” footer and its unused CSS were removed. Search functionality, evidence-scope safeguards, other fixes and original browser keys are unchanged.
