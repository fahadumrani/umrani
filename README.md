# Umrani

A lightweight vanilla JavaScript AI assistant for Urdu, Roman Urdu, and English.

## Run locally

Because the app uses ES modules, serve the project over HTTP:

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

> API keys in a browser frontend are visible to users. Use a backend proxy for production secrets.
