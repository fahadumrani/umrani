# Architecture

`index.html` loads `src/app.js` as an ES module. The entry point imports the runtime coordinator in `src/main.js`, while configuration, streaming-response cleanup, chat title/memory helpers, storage identifiers, and DOM identifiers are maintained in focused modules under `src/config`, `src/api`, `src/core`, `src/ui`, and `src/utils`.

The browser UI persists chats and token state in IndexedDB. AI requests use an OpenAI-compatible streaming endpoint. The API helper layer handles cumulative chunks and prevents repeated rendered blocks. Rewarded-ad event handlers are scoped to their own slot and reset correctly after a successful grant.
