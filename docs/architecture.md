# Architecture

`index.html` loads `src/app.js` as an ES module. The entry point imports the runtime coordinator in `src/main.js`, while configuration, streaming-response cleanup, chat title/memory helpers, storage identifiers, and DOM identifiers are maintained in focused modules under `src/config`, `src/api`, `src/core`, `src/ui`, and `src/utils`.

The browser UI persists chats and a permanent local 10,000-token allowance in IndexedDB. AI requests are sent directly to three Dahl providers in order. Each provider tries DeepSeek first and GLM 5.3 second before the app moves to the next provider. The API helper layer handles cumulative chunks and prevents repeated rendered blocks. The limit screen can focus the Adsterra display ad, but viewing or closing that ad does not change token usage. Because this is a static frontend, API keys are visible to visitors and clearing browser storage can reset the local counter.
