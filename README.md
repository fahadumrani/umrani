# Umrani

A lightweight vanilla JavaScript AI assistant for Urdu, Roman Urdu, and English.

## Architecture

- Static frontend: GitHub Pages / `umrani.devs.li`
- AI providers: ten Dahl browser-side API keys
- Fallback order: one primary account followed by nine account fallbacks
- Model order on every account: DeepSeek, GLM 5.3, then MiniMax M2.7
- No token or daily usage limit
- AI code blocks include Copy and language-aware Download controls
- Upload supports text and source-code files up to 200 KB; up to 60,000
  characters are sent. Image, PDF and DOCX input is not supported.
- Advertising: one Adsterra Native Banner inline after every two complete chats
- Adsterra Social Bar remains enabled for notification-style ads
- Pending ad breaks survive refresh and synchronize to other open tabs
- The composer stays disabled until the user manually closes the available ad
- Only a confirmed Native Banner script request error triggers the blocker
  warning; empty/no-fill containers no longer cause false detection

## Run the frontend locally

The included `dist/app.bundle.js` also lets you open `index.html` directly by
double-clicking it. For development, serving over HTTP is still recommended:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Run the checks with:

```bash
npm test
```

## Source layout

- `src/app.js` — browser entry point
- `src/main.js` — current runtime implementation
- `src/config/` — app and model configuration reference
- `src/core/`, `src/api/`, `src/ui/`, `src/utils/` — organized module boundaries
- `styles/` — stylesheet and theme variables
- `data/` — default model and app settings
- `docs/` — architecture and API notes

> The requested API keys are stored in browser JavaScript. Every website
> visitor can inspect and copy them. A static frontend cannot protect embedded
> API keys.
