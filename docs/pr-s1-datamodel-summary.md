# PR #21 — S1 Datamodel & migrations (summary)

Branch: `feat/autonomous-datamodel`  
**PR:** https://github.com/eskobar95/ai-business/pull/21  

## What ships

- **`task_status` enum:** `todo` mellem `backlog` og `in_progress` (migration `0015`).
- **`tasks`:** `dependency_task_id`, GitHub PR-felter, `pr_merged_to_integration`, `gates_locked_at`; composite FK `(business_id, dependency_task_id) → (business_id, id)` (migration `0016` erstatter den første simple FK).
- **`businesses`:** `integration_branch`, `release_branch`, `max_parallel_runs`, `default_cursor_model_id`, `default_cursor_thinking_effort`.
- **`agents`:** `cursor_model_id`, `cursor_thinking_effort`, `cursor_runtime_profile`, `heartbeat_promotion_cap`.
- **`system_roles`:** `requires_git_workspace`, `may_promote_backlog_to_todo`, `requires_pr_merge_gate`, `runs_heartbeat`.
- **Seed:** `npm run db:seed-system-roles` — upsert af platform-roller med korrekte flags; ved konflikt opdateres **kun** boolean-flag (bevarer evt. manuelt tilpasset `name`/`description`/`base_system_prompt`).
- **App:** `todo` i Kanban, modal, status-select, heartbeat prompt-inclusion, `agentsPublicColumns` udvidet — typecheck/build grønne.

## Obligatorisk før næste spor (S2–S7)

Kør mod den database I bruger til udvikling/staging (poolet `DATABASE_URL` til app; ved behov `DATABASE_DIRECT_URL` til migrate — se `database-architecture.mdc`).

```bash
npm run db:migrate
npm run db:seed-system-roles
```

**`db:seed` (archetypes)** er uændret krav ift. tidligere onboarding; kør hvis miljøet er nyt eller archetypes mangler:

```bash
npm run db:seed
```

Rækkefølge: **migrate → seed-system-roles** (og `db:seed` efter behov). Uden applied `0015`+`0016` vil app-kode og DB ikke matche.

## Verifikation

- `npm run typecheck`
- `npm test -- --run`
- `npm run build`
- `npm run db:studio` — vis nye kolonner og enum-værdi `todo`.
- Efter seed: tjek `system_roles` for de otte slugs med forventede flags (PRD F8 / task-plan).

## Migreringer (filer)

| Fil | Formål |
|-----|--------|
| `drizzle/0015_left_the_phantom.sql` | Enum + nye kolonner + første dependency-FK |
| `drizzle/0016_premium_marvel_apes.sql` | Drop simple dependency-FK, tilføj composite tenant-sikret FK |

Miljø der **kun** har kørt `0015` **skal** køre `0016` før produktion.

## Quality gate

🟢 **Green** — lint, typecheck, tests og build er grønne på branchen.

## Noter til merge-koordinator

- Enum-udvidelse (`ALTER TYPE … ADD VALUE`) er ikke trivialt reversibel uden manuel plan.
- Agent/CI-miljø uden `DATABASE_URL` kan ikke køre migrate/seed her; det er forventet — udfør lokalt eller i deploy-pipeline.
