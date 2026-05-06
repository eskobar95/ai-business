# PR #21 — S1 datamodel & migrations (summary)

Branch: `feat/autonomous-datamodel`  
**PR:** https://github.com/eskobar95/ai-business/pull/21  

## What ships

- **`task_status` enum:** `todo` between `backlog` and `in_progress` (migration `0015`).
- **`tasks`:** `dependency_task_id`, GitHub PR fields, `pr_merged_to_integration`, `gates_locked_at`; composite FK `(business_id, dependency_task_id) → (business_id, id)` (migration `0016` replaces the initial simple FK from `0015`).
- **`businesses`:** `integration_branch`, `release_branch`, `max_parallel_runs`, `default_cursor_model_id`, `default_cursor_thinking_effort`.
- **`agents`:** `cursor_model_id`, `cursor_thinking_effort`, `cursor_runtime_profile`, `heartbeat_promotion_cap`.
- **`system_roles`:** `requires_git_workspace`, `may_promote_backlog_to_todo`, `requires_pr_merge_gate`, `runs_heartbeat`.
- **Seed:** `npm run db:seed-system-roles` — upserts platform roles with the correct flags; on conflict, **only** the boolean columns are updated (preserves manually edited `name` / `description` / `base_system_prompt` if present).
- **App:** `todo` in Kanban, modal, status select, heartbeat prompt inclusion; `agentsPublicColumns` extended — typecheck and build pass.

## Required before the next tracks (S2–S7)

Run against the database you use for dev/staging (pooled `DATABASE_URL` for the app; use `DATABASE_DIRECT_URL` for migrate CLI if needed — see `database-architecture.mdc`).

```bash
npm run db:migrate
npm run db:seed-system-roles
```

**`db:seed` (archetypes)** is unchanged vs. prior onboarding; run on a fresh environment or if archetypes are missing:

```bash
npm run db:seed
```

Order: **migrate → seed-system-roles** (then `db:seed` as needed). Without applied migrations `0015` **and** `0016`, app code and DB will diverge.

## Verification

- `npm run typecheck`
- `npm test -- --run`
- `npm run build`
- `npm run db:studio` — confirm new columns and enum value `todo`.
- After seed: spot-check `system_roles` for the eight slugs and expected flags (PRD F8 / task plan).

## Migration files

| File | Purpose |
|------|---------|
| `drizzle/0015_left_the_phantom.sql` | Enum + new columns + initial dependency FK |
| `drizzle/0016_premium_marvel_apes.sql` | Drop simple dependency FK; add tenant-scoped composite FK |

Any environment that has only run **`0015`** must run **`0016`** before production (see CodeRabbit note: apply all pending migrations in sequence; CI/deploy should not stop mid-journal).

## Quality gate

**Green** — lint, typecheck, tests, and build pass on this branch.

## Notes for merge coordinator

- Enum extension (`ALTER TYPE … ADD VALUE`) is not trivially reversible without a manual plan.
- Agent/CI without `DATABASE_URL` cannot run migrate/seed here; run locally or in the deploy pipeline.
