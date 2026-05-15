# Chat API routes

- **`POST /api/chat/[sessionId]/send`** — Authenticated SSE stream that persists user/assistant turns and proxies Cursor SDK output (see `lib/chat/README.md`).
