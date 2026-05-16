# Cursor SDK wrapper

`agent.ts` exposes `runCursorAgent(prompt, options?)` for the local Cursor runtime (`Agent.create` + streaming). Optional **`apiKey`** comes from decrypted `user_settings` (see Grill-Me) or **`CURSOR_API_KEY`** fallback for workers. Options may include **`model`** (`ModelSelection`) and **`localSettingSources`** (`SettingSource[]`) so callers (e.g. Grill-Me) can pick model + which Cursor filesystem setting layers attach to the repo `cwd`.

`verify-api-key.ts` calls **`Cursor.me({ apiKey })`** (official SDK — no agent run) to validate onboarding / stored keys server-side before persisting ciphertext to `user_settings`.

`server-agent.ts` exposes **`runServerAgentOnce(prompt, apiKey)`** for **server-only** turns: `Agent.create` **without** `local.cwd`, streaming assistant text the same way as `POST /api/chat/.../send`. Used by mission PO briefing and EM decomposition (repo context is injected via `buildRepoContextForPrompt`, not local FS).

For tests, stub `verifyCursorApiKey`, or set **`CURSOR_API_VERIFY_SKIP=1`** with **`NODE_ENV !== "production"`** only (documented in `.env.example`; never ship that in prod).

Official SDK surface (local copy): `node_modules/@cursor/sdk/dist/esm/stubs.d.ts`.
