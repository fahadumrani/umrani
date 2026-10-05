# Umrani

A lightweight vanilla JavaScript AI assistant for Urdu, Roman Urdu, and English.

## Architecture

- Static frontend: GitHub Pages / `umrani.devs.li`
- AI providers: three Dahl browser-side API keys
- Fallback order: primary account, fallback account 1, fallback account 2
- Model order on every account: DeepSeek first, GLM 5.3 second
- Allowance: persistent 10,000-token browser counter
- Advertising: Adsterra display ad (not used as a token-reset signal)

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
> visitor can inspect and copy them. Clearing browser storage can also reset
> the local token counter; a static frontend cannot prevent that.
