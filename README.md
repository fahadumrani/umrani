# Umrani

A lightweight vanilla JavaScript AI assistant for Urdu, Roman Urdu, and English.

## Architecture

- Static frontend: GitHub Pages / `umrani.devs.li`
- AI providers: three Dahl browser-side API keys
- Fallback order: primary account, fallback account 1, fallback account 2
- Model order on every account: DeepSeek first, GLM 5.3 second
- No token or daily usage limit
- Advertising: one Adsterra Social Bar break after every two complete chats

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
