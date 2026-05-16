# Chat UI (universal shell)

Shared chat interface built on [Vercel AI Elements](https://elements.ai-sdk.dev/) with platform styling.

## Entry points

| Surface | Config | Usage |
|---------|--------|--------|
| Agent session page | `CHAT_CONFIGS.agentChat` | [`chat-layout.tsx`](./chat-layout.tsx) → `ChatShell` |
| Conductor widget | `CHAT_CONFIGS.widget` | [`conductor-chat-widget-client.tsx`](../dashboard/conductor-chat-widget-client.tsx) |
| Grill-Me quick replies | `CHAT_CONFIGS.grillMe` | [`input-form.tsx`](../grill-me/input-form.tsx) uses `Suggestion` |

## Key files

- **`chat-shell.tsx`** — Composes messages + input; gates features via `ChatFeatures`.
- **`chat-bubble.tsx`** — User/assistant bubbles; delegates to AI Elements for reasoning, markdown, tools, etc.
- **`chat-message-blocks.tsx`** — Sources, Plan, Task, Tool, Confirmation blocks.
- **`lib/chat/chat-config.ts`** — Feature flags per surface.

## Adding a feature to all chats

1. Install or use the AI Element under `components/ai-elements/`.
2. Render it in `chat-message-blocks.tsx` or `chat-bubble.tsx` behind a `ChatFeatures` flag.
3. Enable the flag in the relevant `CHAT_CONFIGS.*` preset.
