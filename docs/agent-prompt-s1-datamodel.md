# Agent Prompt — S1: Datamodel & Migrations

> **Til agenten:** Læs denne prompt i sin helhed før du laver én eneste filændring. Følg **Git-disciplin** sektionen præcist.

---

## Dit opdrag

Du skal implementere **S1 — Datamodel & Migrations** fra implementation-planen defineret i:

- **PRD:** `docs/prd-autonomous-agent-flow-v1.md`
- **Task-plan:** `docs/tasks-autonomous-agent-flow-v1.md` — afsnittet **S1**

S1 er den **kritiske sti** for hele v1. Alle andre spor (S2–S7) venter på at S1 er merged. Du skal levere **rene, reversible Drizzle-migrationer** og et **opdateret schema** som de andre agenter kan bygge oven på.

---

## Git-disciplin (OBLIGATORISK — gør dette FØR du rører én fil)

### Trin 1 — Sync fra main

```bash
git fetch origin
git status
# Working tree SKAL være clean. Er det ikke: stop og rapporter.
git checkout main
git pull --ff-only origin main
```

### Trin 2 — Opret feature-branch i git worktree

Brug et **isoleret git worktree** så du ikke forstyrrer main-checkout:

```bash
# Fra repo-roden:
git worktree add ../ai-business-s1-datamodel feat/autonomous-datamodel
cd ../ai-business-s1-datamodel
```

Alt arbejde foregår i `../ai-business-s1-datamodel`. Commit aldrig direkte til `main`.

### Trin 3 — Opret Draft PR med det samme (inden du koder)

```bash
gh pr create \
  --title "feat: autonomous agent flow — datamodel & migrations (S1)" \
  --body "$(cat <<'EOF'
## S1 — Datamodel & Migrations

Implementerer alle schema-ændringer der er kritisk sti for autonom agent-orkestrering v1.

**PRD:** docs/prd-autonomous-agent-flow-v1.md  
**Tasks:** docs/tasks-autonomous-agent-flow-v1.md#s1

### Ændringer
- [ ] T1.1 — `task_status` enum: tilføj `todo`
- [ ] T1.2 — Nye felter på `tasks` (dependency, PR-link, gate-flags)
- [ ] T1.3 — Nye felter på `businesses` (branches, parallel-loft, Cursor defaults)
- [ ] T1.4 — Nye felter på `agents` (Cursor runtime, heartbeat cap)
- [ ] T1.5 — Flags på `system_roles` (git, promotion, PR-gate, heartbeat)
- [ ] T1.6 — Seed/backfill system roles med korrekte flags
- [ ] T1.7 — Generate + apply migration; verify schema

### Test
- [ ] `npm test` grøn
- [ ] Migration kører clean på fresh DB

## Quality gate
🟡 Yellow — S1 er kritisk sti; andre spor kan starte når migration er applied.
EOF
)" \
  --draft \
  --base main
```

Notér PR-URL og inkludér den i din rapport.

---

## Kontekst du skal læse FØR implementering

Læs disse filer:

1. `db/schema.ts` — eksisterende schema (forstå navnkonventioner og pattern)
2. `drizzle.config.ts` — forstå migration-setup
3. `docs/prd-autonomous-agent-flow-v1.md` — F1, F5, F7, F8, F10 (de funktionelle krav der driver S1)
4. `docs/tasks-autonomous-agent-flow-v1.md` — afsnittet S1, T1.1–T1.7

Kig **ikke** i `node_modules`, `.next`, eller `drizzle/`-mappen (migrationer genereres, læses ikke).

---

## Implementeringsopgaver

### T1.1 — `task_status` enum: tilføj `todo`

**Fil:** `db/schema.ts`

Find `taskStatusEnum` og tilføj `"todo"` mellem `"backlog"` og `"in_progress"`:

```typescript
export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "todo",
  "in_progress",
  "blocked",
  "in_review",
  "done",
]);
```

**OBS:** PostgreSQL enum-tilføjelse er en `ALTER TYPE ... ADD VALUE`-migration — Drizzle håndterer det korrekt med `db:generate`.

---

### T1.2 — Nye felter på `tasks`

Tilføj til `tasks`-tabellen i `db/schema.ts` (efter eksisterende felter, før `createdAt`):

```typescript
/** FK til anden task (same business); denne task må ikke auto-starte før dependency er done. */
dependencyTaskId: uuid("dependency_task_id"),
/** GitHub PR-nummer linket til denne task (valideret mod githubRepoInstallationId). */
githubPrNumber: integer("github_pr_number"),
/** FK til github_installations; identificerer repo PR tilhører. */
githubRepoInstallationId: uuid("github_repo_installation_id").references(
  () => githubInstallations.id,
  { onDelete: "set null" }
),
/** Synkroniseret fra GitHub webhook: 'draft'|'open'|'approved'|'merged'|'closed'. */
githubPrStatus: text("github_pr_status"),
/** True når GitHub bekræfter PR er merged til business.integrationBranch. */
prMergedToIntegration: boolean("pr_merged_to_integration").notNull().default(false),
/** Tidspunkt hvor alle gates sidst var opfyldt (audit). */
gatesLockedAt: timestamp("gates_locked_at", { withTimezone: true }),
```

Tilføj indexes til `(t) => [...]` blokken:

```typescript
index("tasks_dependency_task_id_idx").on(t.dependencyTaskId),
index("tasks_github_repo_installation_id_idx").on(t.githubRepoInstallationId),
```

Tilføj self-FK for dependency:

```typescript
foreignKey({
  columns: [t.dependencyTaskId],
  foreignColumns: [t.id],
}).onDelete("set null"),
```

---

### T1.3 — Nye felter på `businesses`

Tilføj til `businesses`-tabellen (efter eksisterende felter, før `createdAt`):

```typescript
/** Branch som agenter syncer til og PR'er merges til for at åbne gates. */
integrationBranch: text("integration_branch"),
/** Release-branch — kun menneskegodkendt merge; ingen auto-gate. */
releaseBranch: text("release_branch"),
/** Max antal parallelle agent-runs for dette workspace. null = ubegrænset. */
maxParallelRuns: integer("max_parallel_runs"),
/** Default Cursor model for agenter med cursorModelId='inherit'. null = platform default. */
defaultCursorModelId: text("default_cursor_model_id"),
/** Default Cursor thinking effort for agenter med cursorThinkingEffort='inherit'. */
defaultCursorThinkingEffort: text("default_cursor_thinking_effort"),
```

---

### T1.4 — Nye felter på `agents`

Tilføj til `agents`-tabellen (efter eksisterende felter, før `createdAt`):

```typescript
/**
 * Cursor model til runs for denne agent.
 * 'auto' = Cursor vælger (felt sendes ikke til SDK).
 * 'inherit' = arver fra business default → platform default.
 * Konkret slug (fx 'claude-sonnet-4') = bruges direkte.
 */
cursorModelId: text("cursor_model_id").notNull().default("auto"),
/**
 * Cursor thinking effort.
 * 'auto' = Cursor vælger. 'inherit' = arver fra business. Konkret = 'low'|'medium'|'high'.
 */
cursorThinkingEffort: text("cursor_thinking_effort").notNull().default("auto"),
/** Reserveret til fremtidig Cursor runtime-profil. */
cursorRuntimeProfile: text("cursor_runtime_profile").notNull().default("auto"),
/**
 * Max antal tasks denne agent (hvis lead/heartbeat) må promovere fra backlog→todo pr. heartbeat-tick.
 * Default 3. Kun relevant hvis system_role.runsHeartbeat = true.
 */
heartbeatPromotionCap: integer("heartbeat_promotion_cap").notNull().default(3),
```

---

### T1.5 — Flags på `system_roles`

Tilføj til `system_roles`-tabellen (efter `includeBusinessContext`, før `createdAt`):

```typescript
/**
 * Runner kører git-preflight (fetch, checkout integrationBranch, worktree) for denne rolle.
 * Typisk true for developer/engineer/lead. False for analyst, ux_designer.
 */
requiresGitWorkspace: boolean("requires_git_workspace").notNull().default(false),
/**
 * Agent med denne rolle må kalde promoteTaskToTodo Server Action.
 * Kombineres med teamets leadAgentId check.
 */
mayPromoteBacklogToTodo: boolean("may_promote_backlog_to_todo").notNull().default(false),
/**
 * Gate-check for tasks assignet til denne rolle inkluderer prMergedToIntegration.
 * Typisk true for developer; false for analyst/researcher.
 */
requiresPrMergeGate: boolean("requires_pr_merge_gate").notNull().default(false),
/**
 * Agenten er lead-type og må modtage lead_heartbeat events i runner.
 */
runsHeartbeat: boolean("runs_heartbeat").notNull().default(false),
```

---

### T1.6 — Seed/backfill system roles

**Fil:** `scripts/seed-system-roles.ts` (ny)

Opret scriptet der upsert'er alle platform-roller med korrekte flags:


| slug                  | requiresGitWorkspace | mayPromoteBacklogToTodo | requiresPrMergeGate | runsHeartbeat |
| --------------------- | -------------------- | ----------------------- | ------------------- | ------------- |
| `engineer`            | true                 | false                   | true                | false         |
| `developer`           | true                 | false                   | true                | false         |
| `analyst`             | false                | false                   | false               | false         |
| `researcher`          | false                | false                   | false               | false         |
| `ux_designer`         | false                | false                   | false               | false         |
| `engineering_manager` | false                | true                    | false               | true          |
| `product_owner`       | false                | true                    | false               | true          |
| `lead`                | true                 | true                    | true                | true          |


Script-pattern: brug `db.insert(systemRoles).values([...]).onConflictDoUpdate({ target: systemRoles.slug, set: { ... } })`.

Tilføj npm-script i `package.json`:

```json
"db:seed-system-roles": "npx tsx scripts/seed-system-roles.ts"
```

---

### T1.7 — Generér og apply migration

```bash
npm run db:generate
# Inspect det genererede SQL i drizzle/ mappen — verify det ser fornuftigt ud
npm run db:migrate
```

**Verify:**

- `npm run db:studio` viser alle nye kolonner korrekt.
- Ingen eksisterende data er slettet.
- Kør `npm test` — alle eksisterende tests skal være grønne.

---

## Test-krav

Opret `db/__tests__/schema-s1.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { taskStatusEnum } from "@/db/schema";

describe("S1 schema additions", () => {
  it("taskStatusEnum includes todo", () => {
    expect(taskStatusEnum.enumValues).toContain("todo");
  });

  it("todo is between backlog and in_progress", () => {
    const values = taskStatusEnum.enumValues;
    const backlogIdx = values.indexOf("backlog");
    const todoIdx = values.indexOf("todo");
    const inProgressIdx = values.indexOf("in_progress");
    expect(todoIdx).toBeGreaterThan(backlogIdx);
    expect(todoIdx).toBeLessThan(inProgressIdx);
  });
});
```

Kør: `npm test db/__tests__/schema-s1.test.ts`

---

## Commit-disciplin

Brug **Conventional Commits**, ét commit pr. logisk enhed:

```
feat(schema): add todo to task_status enum (T1.1)
feat(schema): add dependency and PR-link fields to tasks (T1.2)
feat(schema): add branch and parallel settings to businesses (T1.3)
feat(schema): add cursor runtime fields to agents (T1.4)
feat(schema): add behaviour flags to system_roles (T1.5)
feat(seed): upsert system roles with behaviour flags (T1.6)
chore(db): generate and apply S1 migrations (T1.7)
test(schema): verify todo enum and S1 additions (T1.7)
```

Push efter hvert commit:

```bash
git push origin feat/autonomous-datamodel
```

---

## Hvad du IKKE må gøre

- Ændre eksisterende kolonnenavne eller typer (breaking migration).
- Tilføje `NOT NULL` uden `default` på eksisterende tabeller (vil fejle på populated DB).
- Slette eller rename eksisterende enum-værdier.
- Røre filer udenfor `db/schema.ts`, `drizzle/`, `scripts/seed-system-roles.ts`, `package.json` (scripts-blokken), og test-filen ovenfor.
- Merge til `main` — PR er draft, merge-koordinering er menneskets opgave.

---

## Afslutning — din rapport skal indeholde

1. PR-URL (GitHub).
2. Liste over alle commits med hash.
3. Output af `npm test` (grøn).
4. Kort liste over eventuelle afvigelser fra task-planen (med begrundelse).
5. Estimat på om andre spor (S2–S4) kan starte nu (de kan, når migration er applied).

---

## Referencer

- `docs/prd-autonomous-agent-flow-v1.md` — F1 (task-status), F5 (kø/mutex), F7 (git-preflight flags), F8 (system roles), F10 (Cursor runtime)
- `docs/tasks-autonomous-agent-flow-v1.md` — S1, T1.1–T1.7
- `db/schema.ts` — eksisterende schema at bygge oven på
- `drizzle.config.ts` — migration-konfiguration
- `.cursor/rules/database-architecture.mdc` — UUID PKs, UTC timestamps, pooled URL
- `AGENTS.md` — APM_RULES for Server/Client boundary, DB access

