# GitHub-only search and graph behavior

This release replaces the previous `/api/search`/Node setup with browser-only public Wikipedia lookup. The Node server, search proxy, `.env.example` and Windows local launcher are removed. No Cloudflare/Vercel/Netlify account is required.

**Scope:** public encyclopedia excerpts and source URLs, not Google/Bing full-web search or verified live news. Model context and documentation label this limitation. CORS-enabled public lookup can operate on GitHub repository URLs and direct file-open mode, subject to external network/API policy. Currency uses a separate timestamped indicative feed; date uses the device clock. Old model estimates are not claimed as today's rate.

Mathematical parabola requests use safe computed quadratic plots rather than Mermaid. An unspecified equation explicitly defaults to y=x². Simple polynomial coefficients are parsed locally; unsupported/ambiguous equations fall back to model instructions or a visible limitation. No arbitrary function strings are evaluated.

Incomplete Mermaid fences are displayed as code during generation. Complete structural diagrams render in a fixed scratch host and are sanitized. Invalid diagram/error DOM is cleaned up instead of becoming body-level flex siblings that shrink the app, fixing the reported narrow-layout/error-icon failure.

The compact composer contains model and Deep Think controls inside it. CSS tokens are embedded/synchronized for reliable file/static loading. The ad shell survives feed rerenders. On static hosting, a dedicated loader refuses direct/top-level ad execution before loading mutable ad-network code.

See README for root-file upload and GitHub Pages settings. The browser keys remain original/public, per the owner's request.
