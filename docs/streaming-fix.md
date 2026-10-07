# Streaming continuity fix — asset version 58

## Reported symptom and reproduced cause

The user reported initial answer text disappearing, followed by Thinking and a restarted answer. A delayed mocked stream reproduced that exact pattern in the preceding bundle: a transport error after visible output triggered fallback; resetStreamBubble removed the old answer, and the second provider entered reasoning. No live provider trace was obtained, so this demonstrates a concrete code path matching the symptom, not every possible upstream cause.

## Targeted changes

- Automatic fallback remains available before answer text arrives. Mutable provider capacity notices are rejected before they flash as an answer.
- Once answer text has arrived, a transport/provider failure preserves the partial reply rather than replacing it with a blank/new provider stream. The saved reply has an explicit interruption notice and the existing Regenerate action. It is not presented as a complete successful answer and does not trigger an ad.
- Failed partial regeneration keeps the original saved answer and displays a retry message.
- Late structured reasoning events and empty reasoning-only updates cannot clear received answer text or move its visible phase backwards to Thinking. Private structured reasoning is never rendered.
- Cancelled frame/timer handles and a request epoch prevent obsolete paints. The shared painter checks the owner chat, including repetition-cleanup calls. Throttled trailing chunks are flushed without needing another delta.
- AI replies no longer replay an opacity-zero entrance animation when the final saved reply is rerendered. Other layout/theme/logo styles are unchanged.
- CSS and bundle cache URLs increment to v58.

## Changed files

`src/main.js`, `styles/main.css`, `index.html`, regenerated `dist/app.bundle.js`, `package.json`, `scripts/test-streaming.mjs`, `tests/ui/structure.test.mjs`, `README.md`, this document and `docs/test-results.txt`.

## Verification

63 unit tests, 25 existing browser/file groups, 6 reference-interaction groups, 10 light/dark viewport groups and 8 new stream-continuity groups passed. Syntax checks passed. New groups cover late reasoning, empty updates, pre-answer fallback, partial-error preservation, persistent interruption markers, regeneration restoration, owner/epoch isolation and trailing-chunk flushing.

Before/after mock comparison: old bundle made two attempts and showed empty text with Thinking during fallback; fixed bundle made one attempt and preserved its visible partial answer with incomplete=true.

All original keys, provider/model configuration, source icon assets and vendor files remain unchanged. This is a targeted fix, not a resolution of all earlier audit findings. In particular, literal reasoning-tag code filtering, intentional content deduplication and terminal-marker/cutoff integrity concerns are not comprehensively changed by this release. Silent EOF behavior still needs its separate audit fix. Live model validity, microphone/voice service and ad delivery were not tested.

## Deploy

Replace the repository files with the contents of the extracted umrani directory, wait for GitHub Pages deployment, then hard refresh or clear site cache to load v58. No server or additional hosting platform is needed.
