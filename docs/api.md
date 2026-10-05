# API

The runtime sends `POST /v1/chat/completions` with:

- `model`
- `messages`
- `stream: true`

The response is parsed as Server-Sent Events. Endpoint and model definitions live in `src/api/` and provider configuration lives in `src/config/config.js`. Move credentials behind a server-side proxy before production use.
