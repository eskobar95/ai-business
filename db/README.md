# Database (`db/`)

Schema is defined in Drizzle (`schema.ts`). Migrations live under `drizzle/` and are produced by drizzle-kit (with Phase 2 data/backfill SQL inlined where needed).

## Workflow

1. **`npm run db:generate`** — Generates SQL under `drizzle/` from `schema.ts`. `drizzle.config.ts` loads `.env` / `.env.local` and chooses **`DATABASE_DIRECT_URL`** (if set), else **`DATABASE_URL`** — see `.cursor/rules/database-architecture.mdc`.
2. **`npm run db:migrate`** — Applies pending migrations via **`scripts/run-drizzle-migrate.mjs`** (TCP **`postgres`** + Drizzle migrator). Uses **`DATABASE_DIRECT_URL`** when non-empty, otherwise **`DATABASE_URL`**. This path avoids flaky **`drizzle-kit migrate`** with Neon serverless in CI; `drizzle-kit` remains for **`db:generate`** / **`db:studio`**.
3. **`npm run db:seed`** — Upserts launch **`agent_archetypes`** rows (`vertical-fullstack`, `harness-engineer`) via **`db/seeds/archetypes.ts`** (same URL pick order as **`db:migrate`**). Safe to re-run (slug upsert).

## Phase 2 migrations (`0003` / `0004`)

| Migration | Purpose |
| --- | --- |
| **`0003_harsh_turbo.sql`** | DDL: enums (`task_status`, `task_log_author_type`), new tables (`user_settings`, `agent_archetypes`, `agent_documents`, `skill_files`, `agent_mcp_access`, `tasks`, `task_logs`), business columns (`description`, `github_repo_url`, `local_path`), `agents.archetype_id`, nullable `mcp_credentials.business_id`. Then **data backfill**: seed archetypes (`vertical-fullstack`, `harness-engineer`); copy legacy **`agents.instructions` → `agent_documents` with `slug = 'soul'` only**; **`tools` / `heartbeat`** rows are inserted as **empty shells** (see `0003_harsh_turbo.sql`); copy `skills.markdown` → `skill_files` (`SKILL.md`); set MCP `business_id`; populate `agent_mcp_access`. |
| **`0004_phase2_drop_legacy_columns.sql`** | Dedupe MCP rows per `(business_id, mcp_name)`, tighten junction rows, drop `agents.instructions`, `skills.markdown`, `mcp_credentials.agent_id`, **`business_id` NOT NULL**, unique index `mcp_credentials_business_id_mcp_name_unique`. |
| **`0005_slimy_cerebro.sql`** | Same-tenant FKs: `(business_id, id)` unique anchors on `agents` / `teams` / `mcp_credentials` / `approvals` / **`tasks`** (needed for composite self-FK on `parent_task_id`); `agent_mcp_access.business_id` + composite FKs; `tasks` composite FKs for `team_id` / `agent_id` / `parent_task_id` / `approval_id`. |

**Rollback:** Forward-only DDL + destructive drops in `0004`. To reverse in an emergency, restore from backup or recreate dropped columns from `agent_documents` / `skill_files` exports before re-applying older schema — not automated.

## Tables (summary)

| Table | Purpose |
| --- | --- |
| `businesses` | Tenant root; optional `description`, `github_repo_url`, `local_path`. |
| `user_settings` | Per-user settings; encrypted Cursor API key (`cursor_api_key_encrypted` + `cursor_api_key_iv`). |
| `user_businesses` | Links Neon Auth users (`user_id` text) to `businesses`. |
| `agent_archetypes` | Platform presets (slug, addenda for soul/tools/heartbeat). |
| `agents` | Roster per business; optional `archetype_id`, `reports_to_agent_id`. Soul/tools/heartbeat live in **`agent_documents`**. |
| `agent_documents` | Markdown docs per agent; unique `(agent_id, slug)` (`soul`, `tools`, `heartbeat`, custom). |
| `memory` | Markdown memory; `scope` distinguishes business vs agent-level rows. |
| `grill_me_sessions` | Grill-Me ordered turns per business (`seq` unique per business). |
| `skills` | Skill metadata per business; body in **`skill_files`** (path `SKILL.md`, etc.). |
| `skill_files` | Files per skill; unique `(skill_id, path)`. |
| `agent_skills` | Join agents ↔ skills. |
| `teams` / `team_members` | Teams with `lead_agent_id` and member ordering. |
| `mcp_credentials` | Encrypted MCP payloads **per business** (`encrypted_payload` JSON + `iv`); unique `(business_id, mcp_name)`. |
| `agent_mcp_access` | Junction: which agents may use which credential. |
| `tasks` | Business-scoped tasks; status enum; optional team/agent/parent/approval links. |
| `task_logs` | Markdown activity per task (`author_type` agent/human). |
| `missions` | Bounded deliverables (formerly `projects`); `validation_contract` + `project_type` added in `0024`. |
| `sprints` | Sprint iterations within a mission; `goal` stores PO markdown brief; status: `planning` → `active` → `completed`. |
| `github_installations` | GitHub App installation per business; encrypted access token. |
| `github_installation_selected_repos` | Normalized child table: explicit repo selection per installation (null = all repos). |
| `orchestration_events` | Orchestration payloads and correlation fields. |
| `webhook_deliveries` | Delivery audit with idempotency key and attempts. |
| `approvals` | Human approval gate with `artifact_ref` JSON and status enum. PO brief approvals include `{ kind, missionId, sprintId, artifactType: "po_sprint_brief" }` in `artifact_ref`. |

Relations for relational queries are exported next to each table in `schema.ts`.
