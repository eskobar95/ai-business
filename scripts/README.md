# Scripts

## `run-vitest.mjs`

**`npm test`** invokes this launcher. Some Windows setups with a secondary git worktree collect **zero Vitest tasks** unless Vitest starts from the primary checkout with `-r <worktree>`. The script delegates to **`../ai-business`** when present and different from the project root; override with **`AI_BUSINESS_PRIMARY_ROOT`**. Single CI checkouts run Vitest locally (no sibling).

## `run-drizzle-migrate.mjs`

Runs Drizzle migrations from `./drizzle` using the **`postgres`** TCP client (see `package.json` script **`npm run db:migrate`**). Prefer **`DATABASE_DIRECT_URL`** for Neon when available; otherwise **`DATABASE_URL`**.

The Next.js app continues to use Neon HTTP via `getDb()`; this script is only for applying versioned SQL migrations reliably (including in CI).

## `db-reset-app-data.mjs`

**Destructive.** Truncates all rows under `businesses` (and dependent tenants: agents, teams, tasks, MCP, approvals, webhook deliveries, Grill-Me turns, projects/sprints, etc.) so you can start onboarding again.

Does **not** delete `user_settings`, `system_roles`, or `agent_archetypes`.

Requires **`ALLOW_APP_DATA_RESET=1`** in the environment (see `[.env.example](.env.example)`). Prefer a **Neon dev branch**, not production.

PowerShell:

```powershell
$env:ALLOW_APP_DATA_RESET="1"; npm run db:reset-app-data
```

bash:

```bash
ALLOW_APP_DATA_RESET=1 npm run db:reset-app-data
```

## `recover-apm-phase2-from-transcript.mjs`

One-off / repeat use: genskaber **`.apm/spec.md`**, **`.apm/plan.md`**, **Stage 1 Task Bus** (`task.md`), **`.apm/memory/index.md`** (overskrives — kør evt. efterfølgende manuel sync), samt **Task 1.1 / 1.2 Worker handoffs** til **`.apm/memory/handoffs/worker-recovered/`** fra Cursor **agent transcripts** under `%USERPROFILE%\.cursor\projects\c-Users-Nicklas-Github-ai-business\agent-transcripts\`.

Lader **`.apm/tracker.md`** stå urørt (sandhed med PR-merge status skal komme fra repo).
