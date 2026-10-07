# Browser/public APIs

No app-owned API routes or backend are needed.

- **AI:** fixed Dahl chat-completions endpoint, original browser-visible Bearer keys, approved configured models. Browser CORS/account validity is external and unverified with live AI calls.
- **Article lookup:** English or Urdu Wikipedia `w/api.php`, CORS `origin=*`, query generator plus text extracts. Limited to five article excerpts and a 6,500-byte evidence context. This is not a full-web search API.
- **Currency:** `https://open.er-api.com/v6/latest/USD`; validate success, USD base, positive PKR rate and a recent provider timestamp. Display source, timestamp, unit conversions and indicative-rate caveat.
- **Rendering:** pinned SRI CDN assets; no executable AI-generated HTML/JavaScript.

Public APIs can fail, change policy or rate-limit. Errors/empty results are explicit; no fabricated live facts are substituted. Qualifying lookup queries are sent to Wikipedia, while general AI chat/attachments are sent to the configured model provider. Simple date, supported parabola and USD/PKR rate queries are answered locally/from the dedicated feed.
