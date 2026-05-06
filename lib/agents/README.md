# Agent helpers (`lib/agents`)

Shared guardrails for roster UI and server actions:

- `agent-platform-icon-ids.ts` — allowlist of `icon_key` slugs used by the picker and `agents.icon_key`.
- `avatar-validation.ts` — validates stored `avatar_url` (https or allowed `data:image/*;base64,` with size cap).
- `avatar-upsert.ts` — pure resolver from avatar/icon patch → validated DB columns (unit-tested).

Server actions live in [`actions.ts`](./actions.ts). Avatar and `icon_key` can be saved via **`updateAgent`** (one round-trip with other fields) or via **`updateAgentAvatar`** for icon/avatar-only updates (implemented as a thin wrapper over `updateAgent`).
