# Dashboard chats

- `page.tsx` — Lists chat sessions for the workspace, grouped by agent; links to each session.
- `[sessionId]/page.tsx` — Full-screen `ChatLayout` with history loaded from the database.

Both routes resolve `businessId` via `resolveBusinessIdParam` (same pattern as other dashboard pages).
