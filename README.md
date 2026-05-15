# AI Business Platform

Orchestration cockpit for AI-driven businesses and teams. Humans curate and approve; Cursor CLI runs agents locally. Built as a Next.js application with a complete V1.0 feature set covering mission management, sprint planning, PO briefing, EM task decomposition, and human approval gates.

**Platform V1.0 is complete.** See [`docs/platform-v1-completion-report.md`](docs/platform-v1-completion-report.md) for the full feature summary.

## Prerequisites

- Node.js 18+
- Cursor (agent execution via Cursor CLI)

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

Schema: `[db/schema.ts](db/schema.ts)` — 25+ tables. Migrations under `[drizzle/](drizzle/)`. See [`db/README.md`](db/README.md) for table overview.

## Platform features (V1.0)

| Area | What it does |
|------|-------------|
| **Grill-Me onboarding** | Structured interview captures business soul → stored in `memory` table |
| **Conductor agent** | Platform-default agent seeded on business creation; guides owner from template to active agents |
| **Mission wizard** | 4-step guided flow: type → goal → validation contract → review |
| **Sprint UI** | Sprint list + inline create form on mission detail page |
| **PO Briefing** | `runProductOwnerBriefing` → simulated sprint brief + pending approval (single transaction) |
| **Team task-views** | Sidebar Issues links scoped to `?teamId=` — kanban per team |
| **EM Decomposition** | `runEngineeringManagerDecomposition` → 5 backlog tasks + sprint activated (single transaction) |
| **Empty states** | `ConductorNudge` component on all empty dashboard/mission/task pages |
| **GitHub integration** | App OAuth + multi-repo selection stored in normalized child table |
| **Human approvals** | Approve/reject gate between PO brief and EM task creation |

## Agent dispatch workflow

Tasks are dispatched via Cursor's **Task** tool with `subagent_type: generalPurpose`. Each subagent:
1. Works in an isolated git worktree under `.worktrees/<id>/`
2. Implements the feature on its own branch
3. Pushes and opens a PR
4. The parent agent merges after CI + CodeRabbit review

See [`AGENTS.md`](AGENTS.md) for full dispatch rules.

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

