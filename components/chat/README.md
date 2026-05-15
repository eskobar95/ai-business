# Agent chat UI

Production-oriented chat surface for the AI Business Platform: streamed assistant turns, collapsible reasoning, split-pane artifacts, and safe markdown rendering (`react-markdown` + `remark-gfm`).

## Modules

| Path | Role |
|------|------|
| [`useChatStream`](../../hooks/use-chat-stream.ts) | Client hook that posts to `/api/chat/:sessionId/send` and parses SSE into `ChatMessage` rows. |
| [`chat-layout.tsx`](./chat-layout.tsx) | Page shell — header with roster avatar, animated `25% / 75%` split versus full-width chat when an artifact is open. |
| [`chat-messages.tsx`](./chat-messages.tsx) | Scroll viewport with pinned-to-bottom auto-scroll unless the user scrolls up; empty plus skeleton UI. |
| [`chat-bubble.tsx`](./chat-bubble.tsx) | User pills and assistant card with markdown, optional thinking plus stage UX, artifact CTA, question cards. |
| [`chat-input.tsx`](./chat-input.tsx) | Auto-growing textarea, paperclip placeholder, Command or Control plus Enter submit, soft 4000-character counter after 80 percent fill. |
| [`thinking-block.tsx`](./thinking-block.tsx) | Collapsible “Reasoning” rail with smooth height easing. |
| [`stage-indicator.tsx`](./stage-indicator.tsx) | Pulsing chip for ephemeral stage labels emitted while streaming. |
| [`artifact-panel.tsx`](./artifact-panel.tsx) | Right rail preview for document markdown or React source (tsx block plus note about execution). |
| [`question-card.tsx`](./question-card.tsx) | Inline structured questions or options bound to `[answer:id]` payloads from `ChatLayout`. |
| [`chat-markdown.tsx`](./chat-markdown.tsx) | Shared markdown renderer wired for dark tokens and monospace fences. |

## `ChatLayout` props

| Prop | Type | Notes |
|------|------|-------|
| `sessionId` | `string` | Passed to SSE route segment. |
| `businessId` | `string` | Forwarded verbatim in `{ message, businessId }` bodies. |
| `agentName` | `string` | Display name and markdown column header. |
| `agentSlug` | `string` (optional) | Optional subtitle; fallback slugifies `agentName`. |
| `initialMessages` | `ChatMessage[]` | Hydrates client state (`createdAt` strings are normalized to `Date`). |

Open questions enqueue via `QuestionCard`; answers become user-visible turns through `send` with templated payloads.

### Optional `ChatBubble` helpers (wired through `ChatMessages`)

`ChatBubble` exposes optional handlers for composition:

| Prop | When used |
|------|-----------|
| `agentLabel` (optional) | Assistant column heading (defaults to `"Assistant"` if omitted downstream). |
| `onQuestionAnswer` | Mirrors `QuestionCard.onAnswer`. |
| `onViewArtifact` | Opens the staged artifact keyed by originating message IDs. |

## Streaming SSE contract

SSE frames separated by blank lines. Supported `event` types (JSON payloads on `data` lines):

| Event | Payload | Effect |
|-------|---------|--------|
| `stage` | `{ label: string }` | Stores stage text on streaming assistant bubble plus ephemeral hook indicator. |
| `thinking_start` | `{}` | Flips reasoning stream on (`thinking=""`, `thinkingDone=false`). |
| `thinking_delta` | `{ delta: string }` | Appends to reasoning markdown. |
| `thinking_end` | `{}` | Marks reasoning complete. |
| `text_delta` | `{ delta: string }` | Appends assistant visible answer. |
| `artifact_start` | `{ artifactType: "document" or "react", title: string }` | Initializes artifact scaffolding. |
| `artifact_delta` | `{ delta: string }` | Appends streamed artifact payload. |
| `done` | `{}` | Clears `isStreaming`. |
| `error` | `{ message: string }` | Surfaces error text when no assistant body yet.

Unknown events are ignored. Transport errors swap to a deterministic client message without leaking stack traces into chat.
