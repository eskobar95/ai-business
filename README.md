# AI Business

Agentic development setup using **APM** (Agentic Project Management) with **Cursor** sub-agents and hooks.

## Prerequisites

- Node.js 18+
- Cursor
- `agentic-pm` CLI (global): `npm install -g agentic-pm`

## App stack (Next.js + Drizzle + Neon)

- **Next.js 15** (App Router, TypeScript, Turbopack dev).
- **Drizzle ORM** + **drizzle-kit** for schema and migrations.
- **Neon** via `@neondatabase/serverless` and `drizzle-orm/neon-http` (see `[db/index.ts](db/index.ts)` — server-only).

```bash
cp .env.example .env
# set DATABASE_URL to your Neon connection string (pooled URL for the app)

npm install
npm run dev
```

Database scripts:


| Script                | Purpose                                 |
| --------------------- | --------------------------------------- |
| `npm run db:generate` | Generate SQL from `db/schema.ts`        |
| `npm run db:migrate`  | Apply migrations (needs `DATABASE_URL`) |
| `npm run db:reset-app-data` | **Wipes all businesses + tenant data** (needs `ALLOW_APP_DATA_RESET=1`; see `[scripts/README.md](scripts/README.md)`) |
| `npm run db:push`     | Push schema to DB (dev convenience)     |
| `npm run db:studio`   | Open Drizzle Studio                     |


### Vitest og git worktrees (Windows)

`npm test` kører [`scripts/run-vitest.mjs`](scripts/run-vitest.mjs): den finder Vitest i den aktuelle checkout, men **delegérer automatisk** til nabomappen `../ai-business`, når den findes og er en anden rod end worktree-noden (matcher `vitest run -r <worktree>` fra primær checkout). Sæt `AI_BUSINESS_PRIMARY_ROOT` til en absolut eller relativ sti til din primære clone, hvis nabomappen ikke hedder `ai-business`.

CI (`npm test -- --run`) har typisk kun ét checkout og falder igennem til almindelig Vitest. `vitest.config.ts` bruger `passWithNoTests: false`, så tom test-opdagelse ikke ligner succes.

## CI (GitHub Actions)

Workflow: `[.github/workflows/e2e.yml](.github/workflows/e2e.yml)` (job **quality**: Vitest + ESLint + `next build`; job **playwright**: migrate + Playwright).


| Behavior                                 | When                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| **quality** gate                         | Always on PR/`main`: Vitest, ESLint, production build — no DB secrets required.        |
| Smoke (`/`, sign-in, missions redirect, webhooks)  | Part of Playwright on every run; unauthenticated routes only check HTTP status.        |
| Full Grill-Me (`tests/grill-me.spec.ts`) | Runs when **all** repository secrets below are set; otherwise that spec stays skipped. |
| Agents (`tests/agents.spec.ts`)          | Needs **`ENCRYPTION_KEY`** (64 hex chars) so MCP install Server Actions can encrypt credentials; without it the MCP badge assertion fails. |
| Approvals (`tests/approvals.spec.ts`)    | **Optional:** set **`E2E_SETUP_SECRET`**; if missing, that spec is skipped.            |


Configure **Settings → Secrets and variables → Actions** (repository secrets):


| Secret                    | Purpose                                                                        |
| ------------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`            | Neon pooled URL — required for `createBusiness` / Grill-Me persistence in E2E. |
| `NEON_AUTH_BASE_URL`      | Neon Auth configuration URL (same as local `.env`).                            |
| `NEON_AUTH_COOKIE_SECRET` | 32+ character cookie signing secret (same as local).                           |
| `ENCRYPTION_KEY`          | Exactly **64 hex characters** (same as local `.env` / `openssl rand -hex 32`). **Required** for agents E2E (MCP install). |
| `E2E_EMAIL`               | Test user email that can sign in via Neon Auth UI.                             |
| `E2E_PASSWORD`            | Matching password for `E2E_EMAIL`.                                             |
| `E2E_SETUP_SECRET`        | Shared secret for `/api/e2e/seed-approval` — **optional**; enables approvals E2E. |


Use a dedicated Neon branch or disposable credentials for CI; never reuse production secrets.

Ensure the database pointed at by `DATABASE_URL` has migrations applied (`npm run db:migrate` against that branch) before expecting Grill-Me E2E to pass.

Initial schema: `[db/schema.ts](db/schema.ts)` includes a starter `**businesses`** table; SQL is under `[drizzle/](drizzle/)`.

## One-time: APM init (already done in this repo)

```bash
apm init -a cursor
```

## Planner session (once per major planning cycle)

See [docs/APM-PLANNER-KICKOFF.md](docs/APM-PLANNER-KICKOFF.md). Product context for the Planner: [docs/ai-business-platform-spec.md](docs/ai-business-platform-spec.md).

## Ongoing: Manager chat

In your **main** Agent chat:

```text
/apm-2-initiate-manager
```

Workers are spawned via the **Task** tool per `.cursor/rules/apm-worker-subagents.mdc` and [AGENTS.md](AGENTS.md).

## Hooks

[.cursor/hooks.json](.cursor/hooks.json) defines a `subagentStop` prompt hook so the Manager receives a follow-up after each Worker finishes (report delivery and next dispatch).

Reload hooks: save `hooks.json` or restart Cursor. Use **Hooks** in settings / output channel if debugging.

## Verify setup

1. `apm status` shows Cursor assistant installed.
2. `.cursor/commands/` contains `apm-1` … `apm-9` commands.
3. `.cursor/hooks.json` exists and validates as JSON.
4. `.cursor/rules/apm-worker-subagents.mdc` exists with `alwaysApply: true`.
5. After running the Planner, `.apm/bus/<worker-id>/` directories exist for each Worker in the Plan.

## Agent skills (project)

Installed under `[.agents/skills/](.agents/skills/)` via `npx skills add … -y`:


| Skill                         | Source                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `vercel-react-best-practices` | `vercel-labs/agent-skills@vercel-react-best-practices`                         |
| `playwright-best-practices`   | `currents-dev/playwright-best-practices-skill@playwright-best-practices`       |
| `notion-api`                  | `intellectronica/agent-skills@notion-api`                                      |
| `postgres-drizzle`            | `ccheney/robust-skills@postgres-drizzle` (Drizzle + Postgres; Neon-compatible) |


**Note:** `bobmatnyc/claude-mpm-skills@drizzle-orm` is listed on skills.sh but that repo no longer exposes that skill id — `postgres-drizzle` is the installed substitute.

## References

- [APM documentation](https://agentic-project-management.dev/docs/getting-started/)
- [apm-assist skill](https://github.com/sdi2200262/agentic-project-management/tree/main/skills#installing-skills) (optional)

