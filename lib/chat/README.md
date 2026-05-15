# Agent chat (DB + server actions)

Server-side chat persistence and Session Actions for the dashboard agent chat feature.

## Tables

| Table | Purpose |
| --- | --- |
| **`chat_sessions`** | One row per conversation: `business_id`, `agent_id`, `title`, optional `cursor_agent_id` (Cursor SDK agent id for `Agent.resume`), `created_at`, `updated_at`. |
| **`chat_messages`** | Turns in order per session: `session_id`, `role` (`user` \| `assistant`), `content`, optional `metadata` JSON (e.g. `type`: text \| thinking \| artifact \| questions \| stage), `created_at`. |

Relations are defined in `db/schema.ts` (`chatSessionsRelations`, `chatMessagesRelations`) so `db.query.chatSessions` can load `agent` and `messages`.

## Streaming Route Handler

`POST /api/chat/[sessionId]/send` accepts JSON `{ message, businessId }`.

1. Authenticates the user and verifies workspace membership (`auth.getSession` + `assertUserBusinessAccess`).
2. Loads the session, agent “soul” document (`agent_documents.slug === "soul"`), and optional conductor hydration (`applyConductorInstructionPlaceholders` + `loadConductorOrchestrationSnapshot`) for platform-default agents.
3. Resolves an API key via `resolveCursorApiKeyForBusiness` (encrypted user/workspace keys — never returned to the client).
4. Appends the user message to `chat_messages`, builds a prompt from soul + recent history + latest user text, then calls `@cursor/sdk` (`Agent.resume` when `cursor_agent_id` is set, else `Agent.create`).
5. Streams SSE events: `stage`, `text_delta`, `done`, or `error`. Assistant deltas are concatenated and persisted when the stream completes; `cursor_agent_id` is stored on first successful SDK agent creation.

## Cursor API key resolution

Keys are loaded server-side only by `resolveCursorApiKeyForBusiness` from encrypted storage (see `lib/settings/cursor-api-key.ts`). The Route Handler returns `402` when no key is available for the workspace.

## Exports

- **`actions.ts`** — `createChatSession`, `updateSessionCursorAgentId`, `saveChatMessage`, `listChatSessions`, `getChatSession`.
