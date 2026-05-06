# Task-implementation — Autonom Agent-orkestrering v1

**PRD reference:** `docs/prd-autonomous-agent-flow-v1.md`  
**Branch-konvention:** én feature-branch pr. spor (S1–S7); merge til `main` via PR.  
**Test-krav:** Vitest unit/integration pr. ny Server Action eller dispatcher; `npm test` grøn før done.

---

## Paralleliseringsplan

```
Dag 1:      S1 (datamodel) — kritisk sti, alle venter på denne

Herefter parallelt:
  S2 (Workspace settings UI)
  S3 (GitHub webhooks)
  S4 (Task UI & actions)

Når S1+S5 base er klar:
  S5 (Runner core) — kan starte med stub PR-events
  S6 (Trigger-logik) — bygger på S4

Til sidst (afhænger af S3+S5):
  S7 (Lead heartbeat)
```

---

## S1 — Datamodel & migrations

**Branch:** `feat/autonomous-datamodel`  
**Afhænger af:** intet  
**Leverer til:** alle andre spor

### T1.1 — `task_status` enum: tilføj `todo`

**Fil:** `db/schema.ts` + ny migration  
**Ændring:**
```typescript
export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "todo",        // ← ny
  "in_progress",
  "blocked",
  "in_review",
  "done",
]);
```
**Migration:** `ALTER TYPE task_status ADD VALUE 'todo'`  
**Test:** Vitest smoke-test der inserter task med status `todo`.

---

### T1.2 — Nye felter på `tasks`

**Fil:** `db/schema.ts` + migration

```typescript
dependencyTaskId: uuid("dependency_task_id"),          // FK tasks.id same business; nullable
githubPrNumber: integer("github_pr_number"),           // nullable
githubRepoInstallationId: uuid("github_repo_installation_id"), // FK github_installations; nullable
githubPrStatus: text("github_pr_status"),              // 'draft'|'open'|'approved'|'merged'; nullable
prMergedToIntegration: boolean("pr_merged_to_integration").notNull().default(false),
gatesLockedAt: timestamp("gates_locked_at", { withTimezone: true }), // nullable
```

FK + indexes: `dependency_task_id`, `github_repo_installation_id`.  
Self-FK: `tasks(dependency_task_id) → tasks(id) ON DELETE SET NULL`.

---

### T1.3 — Nye felter på `businesses`

**Fil:** `db/schema.ts` + migration

```typescript
integrationBranch: text("integration_branch"),         // nullable; required for execution
releaseBranch: text("release_branch"),                 // nullable; UI/politik kun
maxParallelRuns: integer("max_parallel_runs"),          // nullable; null = ubegrænset
defaultCursorModelId: text("default_cursor_model_id"), // nullable
defaultCursorThinkingEffort: text("default_cursor_thinking_effort"), // nullable
```

---

### T1.4 — Nye felter på `agents`

**Fil:** `db/schema.ts` + migration

```typescript
cursorModelId: text("cursor_model_id").notNull().default("auto"),
cursorThinkingEffort: text("cursor_thinking_effort").notNull().default("auto"),
cursorRuntimeProfile: text("cursor_runtime_profile").notNull().default("auto"),
heartbeatPromotionCap: integer("heartbeat_promotion_cap").notNull().default(3),
```

---

### T1.5 — Flags på `system_roles`

**Fil:** `db/schema.ts` + migration

```typescript
requiresGitWorkspace: boolean("requires_git_workspace").notNull().default(false),
mayPromoteBacklogToTodo: boolean("may_promote_backlog_to_todo").notNull().default(false),
requiresPrMergeGate: boolean("requires_pr_merge_gate").notNull().default(false),
runsHeartbeat: boolean("runs_heartbeat").notNull().default(false),
```

---

### T1.6 — Seed/backfill system roles

**Fil:** ny migration eller seed-script `scripts/seed-system-roles.ts`

Upsert med korrekte flags for: `engineer`/`developer`, `analyst`, `researcher`, `ux_designer`, `engineering_manager`, `product_owner`, `lead`.

Se flag-tabel i PRD F8.

**Test:** Verify alle slugs findes med korrekte flag-værdier.

---

### T1.7 — Generer + apply migration

```bash
npm run db:generate
npm run db:migrate
```

**Acceptance:** `npm run db:studio` viser alle nye kolonner; eksisterende tests grønne.

---

## S2 — Workspace settings UI & API

**Branch:** `feat/workspace-settings`  
**Afhænger af:** S1 landed  
**Leverer til:** S5 (integrationBranch), S7 (promotion cap)

### T2.1 — Branch-settings sektion i `/dashboard/settings`

**Filer:** `app/dashboard/settings/page.tsx`, ny `components/settings/branch-settings-form.tsx`

UI-felter:
- **Integration branch** (text input, required for execution)
- **Release branch** (text input, optional, tooltip: "Kun du godkender merge hertil")
- Save-knap med Server Action

**Server Action:** `lib/settings/actions.ts` → `updateBusinessBranchSettings(businessId, { integrationBranch, releaseBranch })`  
Validering: branch-navn må ikke indeholde mellemrum eller ugyldige git-tegn.

---

### T2.2 — Parallel-loft sektion

**Fil:** `components/settings/parallel-settings-form.tsx`

UI:
- Toggle: "Aktiver parallel-loft" (false default)
- Tal-input: "Max parallelle agent-runs" (min 1; kun synlig når toggle er aktiv)
- Tooltip: "Gælder for hele dit workspace. Slået fra = ubegrænset (kun per-agent mutex)."

**Server Action:** `updateBusinessParallelSettings(businessId, { maxParallelRuns: number | null })`

---

### T2.3 — Business memory editor

**Filer:** `app/dashboard/settings/page.tsx`, ny `components/settings/memory-editor.tsx`

- Hent alle `memory`-rækker med `scope = 'business'` for business.
- Rich text editor (TiptapEditor, genbrugt fra task-description).
- Auto-save (3s debounce) med `updateMemoryContent(memoryId, content)` Server Action.
- "+ Ny sektion"-knap der indsætter ny `memory`-række.
- Tooltips forklarer: "Business memory injiceres i agent-prompts der har 'Include business context' aktiveret."

---

### T2.4 — Cursor defaults sektion (business-niveau)

**Fil:** `components/settings/cursor-defaults-form.tsx`

Felter: `defaultCursorModelId`, `defaultCursorThinkingEffort` — dropdowns med `auto`/`inherit`/konkrete model-slugs (hentes fra konstant).  
Tooltip: "`auto` = Cursor vælger. `inherit` = agent arver herfra."

---

## S3 — GitHub webhooks (PR-sandhed)

**Branch:** `feat/github-pr-webhooks`  
**Afhænger af:** S1 landed (task-felter)  
**Leverer til:** S5 (gate-evaluering), S7 (heartbeat kan læse PR-status)

### T3.1 — GitHub App webhook endpoint

**Fil:** `app/api/github/webhook/route.ts` (ny, separat fra eksisterende install/callback)

```
POST /api/github/webhook
Headers: x-hub-signature-256, x-github-event
```

**Flow:**
1. Verificer HMAC-signatur mod `GITHUB_WEBHOOK_SECRET` (konstant-tid sammenligning).
2. Parse event-type: kun `pull_request` håndteres i v1.
3. Idempotency: `x-github-delivery` header som nøgle → skip hvis allerede behandlet.
4. Dispatch til handler.

**Nye env-variabler:** `GITHUB_WEBHOOK_SECRET` — tilføj til `.env.example`.

---

### T3.2 — PR event handler

**Fil:** `lib/github/pr-webhook-handler.ts`

```typescript
export async function handlePullRequestEvent(payload: GitHubPRPayload): Promise<void>
```

Logik:
1. Find `github_installations` der matcher `payload.repository.full_name`.
2. Find business der har installationen.
3. Hent `business.integrationBranch`.
4. Opdater `tasks.githubPrStatus` (alle tasks med matching `githubPrNumber` + `githubRepoInstallationId`):
   - `opened`/`reopened` → `'open'`
   - `converted_to_draft` → `'draft'`
   - `ready_for_review` → `'open'`
   - `closed` + `merged = true` + `base.ref === integrationBranch` → `'merged'`, sæt `prMergedToIntegration = true`, sæt `gatesLockedAt`
   - `closed` + `merged = false` → `'closed'`
5. Log `github.pr.merged` event til `orchestration_events` ved merge.

**Test:** Vitest med mock payloads for alle actions; verify DB-opdateringer + event-log.

---

### T3.3 — PR-status badge i task UI

**Fil:** `components/tasks/task-pr-badge.tsx` (ny)

Props: `status: 'draft' | 'open' | 'approved' | 'merged' | 'closed' | null`  
Vises på task-kort (liste) og task-detail sidebar.  
Farver: draft=grå, open=gul, approved=blå, merged=grøn, closed=rød.

---

## S4 — Task UI & actions

**Branch:** `feat/task-lifecycle`  
**Afhænger af:** S1 landed  
**Leverer til:** S6 (kommentar-routing), S7 (gate-evaluering)

### T4.1 — `backlog → todo` promotion Server Action

**Fil:** `lib/tasks/actions.ts`

```typescript
export async function promoteTaskToTodo(taskId: string): Promise<void>
```

Guards (i rækkefølge):
1. Task eksisterer og tilhører brugerens business.
2. Task har status `backlog`.
3. Caller er autoriseret (se T4.2).
4. Opdater `status = 'todo'`.
5. Log `task.promoted_to_todo` event.

---

### T4.2 — Promotion-autorisering

**Fil:** `lib/tasks/promotion-auth.ts` (ny)

```typescript
export async function assertMayPromoteToTodo(
  taskId: string,
  callerId: string,
  callerType: 'human' | 'agent'
): Promise<void>
```

- **Human:** `assertUserBusinessAccess` (alle mennesker med business-adgang).
- **Agent:** Check `system_role.mayPromoteBacklogToTodo = true` **eller** `teams.leadAgentId = agentId` for det team task hører under.

**`PROMOTION_ALLOWLIST_SLUGS`** — konstant i filen: `['engineering_manager', 'product_owner', 'lead']`.

**Test:** Vitest for alle cases (human ok, lead-agent ok, worker-agent rejected, wrong-business rejected).

---

### T4.3 — Dependency-picker i task-UI

**Fil:** `components/tasks/task-detail-sidebar.tsx`

- Dropdown: søg og vælg én "Blokkeret af"-task (fra samme business, ikke sig selv).
- Server Action: `updateTaskDependency(taskId, dependencyTaskId | null)`.
- Vis dependency-status inline (badge med status-farve).
- Tooltip: "Task kan ikke auto-starte før denne er done."

---

### T4.4 — PR-link felt i task-UI

**Filer:** `components/tasks/task-detail-sidebar.tsx`, ny `components/tasks/task-pr-link-form.tsx`

- To felter: **PR-nummer** (integer) + **Repo/installation** (dropdown fra `github_installations` for business).
- Valider at `githubPrNumber` er et positivt integer og at installation eksisterer i business.
- Server Action: `updateTaskPrLink(taskId, { githubPrNumber, githubRepoInstallationId })`.
- Vis PR-status badge (T3.3) ved siden af felterne.

---

### T4.5 — `todo` status i task-status-UI

Tilføj `todo` til status-valgmuligheder i task-detail og task-kort.  
Farve: lys lilla/indigo (adskilt visuelt fra `in_progress`).  
Vis kort tooltip: "Agent starter automatisk når gates er grønne."

---

### T4.6 — Gate-status indikator

**Fil:** `components/tasks/task-gate-status.tsx` (ny)

Vises på task-detail når task er `todo` eller `backlog` med dependency/PR sat:

```
✓ Dependency: done
⧗ PR: afventer merge til staging
→ Gates: ikke klar (auto-start blokeret)
```

Logik er ren UI (læser `task.dependencyTaskId`-status og `prMergedToIntegration`).

---

## S5 — Runner core

**Branch:** `feat/runner-core`  
**Afhænger af:** S1 (minimum); kan køre med stubbet PR-status  
**Leverer til:** S7 (lead_heartbeat kræver runner-infrastruktur)

### T5.1 — Per-agent mutex

**Fil:** `runner/queue/job-queue.ts` (tilpas eksisterende)

- `fairShareNext()` returnerer kun job for agenter der **ikke** har et inflight job.
- In-memory Set + DB-kolonne `agent_jobs.status = 'inflight'` som kilde til sandhed.
- Test: Vitest — to jobs for samme agent → kun ét startes; to jobs for forskellige agenter → begge startes.

---

### T5.2 — Optional business parallel-loft

**Fil:** `runner/queue/job-queue.ts`

- Hent `businesses.maxParallelRuns` for hvert job's business.
- Tæl `inflight`-jobs for business.
- Bloker hvis `inflight >= maxParallelRuns` (kun hvis `maxParallelRuns IS NOT NULL`).
- Test: loft=2, 3 jobs → 2 startes, 1 venter.

---

### T5.3 — Udvid dispatcher til `mention_trigger` → `webhook_trigger`

**Fil:** `runner/dispatch.ts`

- Fjern "Unsupported orchestration type"-fejl for `mention_trigger`.
- Map `mention_trigger` payloads til samme flow som `webhook_trigger` med ekstra felt `{ trigger: 'mention', excerpt }`.
- Prompt-builder: tilføj mention-kontekst ("En bruger nævnte dig på task X: …").

---

### T5.4 — Git-preflight modul

**Fil:** `runner/git-preflight.ts` (ny)

```typescript
export async function runGitPreflight(opts: {
  localPath: string;
  integrationBranch: string;
  prBranch?: string;
  worktreeKey?: string;
}): Promise<{ cwd: string; cleanup: () => void }>
```

Trin:
1. `git -C localPath fetch origin` — fejl = abort.
2. `git -C localPath status --porcelain` — ikke-tom output = abort med besked "Dirty working tree".
3. `git -C localPath checkout integrationBranch && git pull --ff-only` — fejl = abort.
4. Hvis `prBranch` sat: opret/genrug git worktree for den branch.
5. Return `{ cwd, cleanup }`.

Log hvert trin til `orchestration_events` (type `runner.git_preflight`).

**Test:** Mock child_process; verify abort-betingelser og log-output.

---

### T5.5 — Integrer git-preflight i dispatcher

**Fil:** `runner/dispatch.ts`

- Kald `runGitPreflight` **kun** hvis `agent.systemRole.requiresGitWorkspace = true`.
- Erstatter eksisterende `prepareWorkingDirectory`-logik der ikke har git-disciplin.
- Abort-fejl logges og event markeres `failed` med beskrivende `runnerError`.

---

### T5.6 — Resolver: Cursor runtime felter

**Fil:** `runner/cursor-config-resolver.ts` (ny)

```typescript
export async function resolveCursorConfig(agentId: string, businessId: string): Promise<{
  modelId: string;
  thinkingEffort: string;
}>
```

Kæde: agent-felt → (hvis `'inherit'`) business default → platform default (`composer-2` / `auto`).  
`'auto'` på agent-felt → send ikke feltet til SDK (Cursor vælger).

**Test:** Alle kombinationer af `auto`/`inherit`/konkret-værdi på begge niveauer.

---

### T5.7 — Readiness-gate check

**Fil:** `runner/readiness-check.ts` (ny)

```typescript
export async function assertBusinessReadyForExecution(businessId: string): Promise<void>
```

Kaster beskrivende fejl for hvert manglende krav (se PRD Minimum readiness gate).  
Kaldes i `dispatchOrchestrationEvent` **før** alt andet.

---

### T5.8 — Tilføj `lead_heartbeat` event-type til dispatcher

**Fil:** `runner/dispatch.ts`

- Ny case: `lead_heartbeat` → kalder `dispatchLeadHeartbeat(eventId, event, apiKey)`.
- Stub i v1 (logs event, returnerer success) — fyldes ud i S7.

---

## S6 — Trigger-logik (kommentarer & gates)

**Branch:** `feat/trigger-logic`  
**Afhænger af:** S4 (task-actions), S1  
**Leverer til:** S5 (runner korrekte event-payloads)

### T6.1 — Kommentar-routing

**Fil:** `lib/tasks/mention-trigger.ts` (omskriv)

Ny adfærd (se PRD F4):
- Ingen mention i tekst **og** task har assigneret agent → opret `webhook_trigger` med `{ trigger: 'mention', agentId: task.agentId, taskId, excerpt }`.
- Mentions fundet → for hver matchet agent: opret `webhook_trigger` med samme payload.
- Brug `webhook_trigger` (ikke `mention_trigger`) — fjern `mention_trigger` som type.

**Test:** Omskriv eksisterende test i `lib/tasks/__tests__/mention-trigger.test.ts`.

---

### T6.2 — Gate-evaluerings-funktion

**Fil:** `lib/tasks/gate-evaluator.ts` (ny)

```typescript
export async function evaluateTaskGates(taskId: string): Promise<{
  ready: boolean;
  reasons: string[];
}>
```

Logik:
```
dependency_ok = dependencyTaskId IS NULL || dependency.status === 'done'
pr_ok = githubPrNumber IS NULL || prMergedToIntegration === true
ready = dependency_ok && pr_ok
```

Returnerer human-readable `reasons` hvis `ready = false`.

**Test:** Alle kombinationer (ingen gates, dep kun, PR kun, begge).

---

### T6.3 — Auto-trigger fra `todo`

**Fil:** `lib/tasks/auto-trigger.ts` (ny)

```typescript
export async function maybeAutoTriggerTask(taskId: string): Promise<void>
```

Kaldes:
- Når task flyttes til `todo` (i `promoteTaskToTodo`).
- Når `prMergedToIntegration` sættes til `true` på en `todo`-task.
- Når dependency-task skifter til `done` og der er `todo`-tasks der peger på den.

Logik: `evaluateTaskGates` → hvis ready → opret `webhook_trigger` event med `{ taskId, trigger: 'auto_todo' }`.

**Test:** Verify at trigger kun oprettes én gang (idempotency via `gatesLockedAt`).

---

## S7 — Lead heartbeat

**Branch:** `feat/lead-heartbeat`  
**Afhænger af:** S1, S3 (PR-sandhed i DB), S5 (runner + mutex + dispatcher)  
**Leverer til:** Fuldt autonomt flow

### T7.1 — Lead heartbeat dispatcher

**Fil:** `runner/lead-heartbeat.ts` (ny)

```typescript
export async function dispatchLeadHeartbeat(
  eventId: string,
  event: { businessId: string; payload: Record<string, unknown> },
  apiKey: string
): Promise<void>
```

Logik:
1. Kald `assertBusinessReadyForExecution`.
2. Find lead-agent (team.leadAgentId eller system_role.runsHeartbeat = true).
3. Byg prompt: business memory + agent soul + PR-status summary for business's aktive tasks.
4. Kør Cursor SDK (uden git-preflight — lead er orchestration, ikke code).
5. Parser lead-output for promotions (struktureret JSON-svar fra lead-agent).
6. Kald `promoteTaskToTodo` for maksimalt `agent.heartbeatPromotionCap` tasks.
7. Log alt til `orchestration_events`.

---

### T7.2 — Lead heartbeat prompt-builder

**Fil:** `runner/lead-heartbeat-prompt.ts` (ny)

Prompt-sektioner:
1. System role base prompt.
2. Business memory.
3. Agent soul/instructions.
4. Aktuelle sprint-tasks med status, gates, PR-status.
5. Instruktion: "Returner JSON med liste af task-IDs der bør promoveres til todo (max N)."

**Test:** Snapshot-test af prompt-output for known input.

---

### T7.3 — Lead heartbeat trigger fra `runHeartbeat`

**Fil:** `lib/heartbeat/actions.ts`

Tilpas eksisterende `runHeartbeat`:
- Tilføj check: hvis `system_role.runsHeartbeat = true` → kald `lead_heartbeat`-flow.
- Ellers → eksisterende heartbeat-flow.

---

### T7.4 — Lead heartbeat scheduler (polling)

**Fil:** `runner/poll.ts`

- Udvid `pollOnce` til også at oprette `lead_heartbeat` events for alle businesses der har en lead-agent med aktiv heartbeat (fx via `agents.routines` tabellen der allerede eksisterer, eller simpel tids-check).
- Alternativt: lead-heartbeat oprettes af runner selv hvert N minut per business med lead-agent.

---

## Tværgående opgaver

### TX1 — Agent settings: fjern UI stubs

**Fil:** `components/agents/agent-settings-form.tsx`

- Tilslut `cursorModelId`, `cursorThinkingEffort`, `cursorRuntimeProfile`, `heartbeatPromotionCap` til rigtige DB-felter.
- Dropdowns for model/effort (konstant-liste + `'auto'`/`'inherit'` som første valg).
- `heartbeatPromotionCap`: number input, min 1, kun synlig hvis `system_role.runsHeartbeat = true`.
- Tilføj tooltips for **Agent Role** vs **System Role** (?, 1-2 linjer).
- `handleSave` gemmer alle felter — ikke kun identity.

**Server Action:** Udvid `updateAgent` til at acceptere og gemme alle nye felter.

---

### TX2 — `.env.example` og dokumentation

Nye variabler:
```
GITHUB_WEBHOOK_SECRET=   # GitHub App webhook secret for PR events
```

Opdater `README.md` med:
- Ny `GITHUB_WEBHOOK_SECRET` variabel.
- Beskrivelse af `integrationBranch` / `releaseBranch` i workspace settings.
- Hvad der nu kræves for autonomt flow (readiness-gate checkliste).

---

### TX3 — Integration test: end-to-end gate + trigger

**Fil:** `__tests__/integration/autonomous-flow.test.ts` (ny)

Scenario:
1. Opret task med `status = 'backlog'`, dependency-task og PR-link.
2. Sæt dependency-task til `done`.
3. Sæt `prMergedToIntegration = true`.
4. Kald `promoteTaskToTodo` → verify `status = 'todo'`.
5. Verify `webhook_trigger` event oprettet i `orchestration_events`.

---

### TX4 — Ryd op i eksisterende `mention_trigger` pending events

**Script:** `scripts/cleanup-mention-triggers.ts`

Marker alle eksisterende `mention_trigger`-events med status `pending` som `failed` med reason "Deprecated: migrated to webhook_trigger".  
Køres som engangsmigration.

---

## Acceptance-kriterier (samlet)

| Krav | Gate |
|------|------|
| `todo` status i enum og UI | T1.1, T4.5 |
| Dependency + PR-link på task | T1.2, T4.3, T4.4 |
| Gate-evaluering korrekt (AND) | T6.2 test |
| Promotion kun af autoriserede | T4.2 test |
| GitHub webhook verificeret + PR-status i DB | T3.2 test |
| Runner: per-agent mutex | T5.1 test |
| Runner: git-preflight abort ved dirty tree | T5.4 test |
| Runner: Cursor-felter fra DB, ikke stubs | TX1, T5.6 |
| Lead heartbeat kører i runner | T7.1 |
| Kommentar-routing (ingen mention → worker) | T6.1 test |
| Business memory redigerbar i settings | T2.3 |
| Workspace branch-settings | T2.1 |
| Alle eksisterende tests grønne | `npm test` |

---

## Estimat og rækkefølge til backlog

| Spor | Opgaver | Estimat | Parallelt med |
|------|---------|---------|---------------|
| S1 | T1.1–T1.7 | ~1 dag | Ingen (kritisk sti) |
| S2 | T2.1–T2.4 | ~2 dage | S3, S4 |
| S3 | T3.1–T3.3 | ~2 dage | S2, S4 |
| S4 | T4.1–T4.6 | ~2 dage | S2, S3 |
| S5 | T5.1–T5.8 | ~3 dage | S2, S3, S4 |
| S6 | T6.1–T6.3 | ~1.5 dage | S5 base klar |
| S7 | T7.1–T7.4 | ~2 dage | Sidst |
| TX | TX1–TX4 | ~1.5 dage | Løbende |

**Total:** ~13–15 dages arbejde; med 3 parallelle agenter (S2∥S3∥S4 efter S1): **~6–8 dage til done**.
