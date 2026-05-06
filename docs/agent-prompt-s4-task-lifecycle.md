# Agent Prompt — S4: Task Lifecycle UI & Actions

> **Til agenten:** Læs denne prompt i sin helhed før du rører én fil. Følg **Git-disciplin** præcist — ingen undtagelser.

---

## Dit opdrag

Du skal implementere **S4 — Task Lifecycle UI & Actions** fra:

- **PRD:** `docs/prd-autonomous-agent-flow-v1.md` — F1 (task-status), F2 (promotion), F3 (gates)
- **Task-plan:** `docs/tasks-autonomous-agent-flow-v1.md` — afsnittet **S4**, T4.1–T4.6

S4 kører **parallelt** med S2 og S3. Du leverer **promotion-logik, RBAC, dependency-picker, PR-link UI og `todo`-status til task-UI**. S6 (trigger-logik) og S7 (heartbeat) bygger direkte oven på dit arbejde.

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

### Trin 2 — Opret feature-branch i isoleret git worktree

```bash
# Fra repo-roden (C:/Users/Nicklas/Github/ai-business):
git worktree add ../ai-business-s4-tasks feat/task-lifecycle
cd ../ai-business-s4-tasks
```

Alt arbejde foregår i `../ai-business-s4-tasks`. Commit aldrig direkte til `main`.

### Trin 3 — Opret Draft PR med det samme (inden du koder)

```bash
cd ../ai-business-s4-tasks
gh pr create \
  --title "feat: task lifecycle — todo status, promotion RBAC, dependency, PR-link, gate UI (S4)" \
  --body "## S4 — Task Lifecycle UI & Actions

Implementerer todo-status, RBAC-beskyttet promotion, dependency-picker, PR-link og gate-indikator.

**PRD:** docs/prd-autonomous-agent-flow-v1.md (F1, F2, F3)
**Tasks:** docs/tasks-autonomous-agent-flow-v1.md#s4

### Ændringer
- [ ] T4.1 — promoteTaskToTodo Server Action
- [ ] T4.2 — Promotion-autorisering (human/lead/allowlist RBAC)
- [ ] T4.3 — Dependency-picker i task sidebar
- [ ] T4.4 — PR-link felt (prNumber + installation dropdown)
- [ ] T4.5 — todo status i task UI (farve, tooltip)
- [ ] T4.6 — Gate-status indikator komponent

### Test
- [ ] npm test grøn
- [ ] Vitest: promotion RBAC alle cases, dependency-validering, PR-link validering

## Quality gate
🟡 Yellow — S4 leverer til S6 (kommentar-routing) og S7 (gate-evaluering)." \
  --draft \
  --base main
```

Notér PR-URL og inkludér den i din rapport.

---

## Kontekst du skal læse FØR implementering

1. `lib/tasks/actions.ts` — eksisterende task Server Actions (forstå pattern for guards og DB-writes)
2. `components/tasks/task-detail-sidebar.tsx` — eksisterende sidebar (her tilføjes dependency + PR-link)
3. `components/tasks/task-detail-client.tsx` — task-detail klient-komponent (forstå state-flow)
4. `db/schema.ts` — find `tasks`, `agents`, `teams`, `systemRoles`, `githubInstallations` (forstå nye S1-felter)
5. `lib/grill-me/access.ts` — `assertUserBusinessAccess`
6. `lib/roster/session.ts` — `requireSessionUserId`
7. `lib/orchestration/events.ts` — `logEvent`
8. `docs/prd-autonomous-agent-flow-v1.md` — F1 (statusser), F2 (promotion guards), F3 (gate-logik)

Læs **ikke** `node_modules`, `.next`, `drizzle/`.

---

## Implementeringsopgaver

### T4.1 — `promoteTaskToTodo` Server Action

**Fil:** `lib/tasks/actions.ts` — tilføj ny export

```typescript
export async function promoteTaskToTodo(taskId: string): Promise<void>
```

**Guards i rækkefølge (kast Error med beskrivende besked ved fejl):**

1. Hent task — kast `"Task not found"` hvis ikke eksisterer.
2. `assertUserBusinessAccess` for den autentificerede bruger.
3. Kræv `task.status === 'backlog'` — kast `"Task must be in backlog to promote"`.
4. Kræv autorisering — kald `assertMayPromoteToTodo` (T4.2) med `callerType: 'human'`.
5. Opdater: `db.update(tasks).set({ status: 'todo', updatedAt: new Date() })`.
6. Log: `logEvent({ type: 'task.promoted_to_todo', businessId: task.businessId, payload: { taskId }, status: 'succeeded' })`.

---

### T4.2 — Promotion-autorisering

**Ny fil:** `lib/tasks/promotion-auth.ts`

Authoritativ policy er **`system_roles.may_promote_backlog_to_todo`** og **team lead** — ikke en slug-allowlist i koden (typiske seed-slugs: `engineering_manager`, `product_owner`, `lead`).

```typescript
/**
 * Kaster hvis caller ikke har ret til at promovere taskId fra backlog→todo.
 *
 * Human: alle med business-adgang må promovere.
 * Agent: kræver system_role.mayPromoteBacklogToTodo=true ELLER
 *        teams.leadAgentId=callerId for det team task'en hører under.
 */
export async function assertMayPromoteToTodo(
  taskId: string,
  callerId: string,
  callerType: "human" | "agent"
): Promise<void>
```

**Implementering:**

```typescript
// Human: tjek kun at de har business-adgang (allerede gjort i action)
if (callerType === "human") return;

// Agent-sti:
const db = getDb();

// 1. Hent task for businessId og teamId
const task = await db.query.tasks.findFirst({
  where: eq(tasks.id, taskId),
  columns: { businessId: true, teamId: true }
});
if (!task) throw new Error("Task not found");

// 2. Check system_role flag
const agent = await db.query.agents.findFirst({
  where: and(eq(agents.id, callerId), eq(agents.businessId, task.businessId)),
  with: { systemRole: { columns: { mayPromoteBacklogToTodo: true, slug: true } } }
});

if (!agent) throw new Error("Agent not found in this business");

if (agent.systemRole?.mayPromoteBacklogToTodo === true) return; // har ret via rolle

// 3. Check lead agent på task'ens team
if (task.teamId) {
  const team = await db.query.teams.findFirst({
    where: and(eq(teams.id, task.teamId), eq(teams.businessId, task.businessId)),
    columns: { leadAgentId: true }
  });
  if (team?.leadAgentId === callerId) return; // har ret som team lead
}

throw new Error("Agent is not authorized to promote tasks to todo");
```

**Test (se test-afsnit nedenfor).**

---

### T4.3 — Dependency-picker i task sidebar

**Fil:** `components/tasks/task-detail-sidebar.tsx`

Tilføj ny sektion "Blokkeret af" i sidebaren.

**Ny Server Action i `lib/tasks/actions.ts`:**

```typescript
export async function updateTaskDependency(
  taskId: string,
  dependencyTaskId: string | null
): Promise<void>
```

Guards:
- `assertTaskInBusinessForUser` for taskId.
- Hvis `dependencyTaskId` ikke er null: verify at dependency-task tilhører samme business, og at `dependencyTaskId !== taskId` (self-dependency forbudt).
- Opdater `tasks.dependencyTaskId`.

**UI i sidebar:**

```
Sektion: "Blokkeret af"
  └─ Dropdown/søgefelt: vælg fra tasks i samme business
     - Vis task-titel + nuværende status som badge
     - "Ingen dependency" som første option (sætter null)
  └─ Under dropdown: hvis valgt, vis badge:
     ✓ Dependency: done      (grøn)
     ⧗ Dependency: in_progress (gul)
     ✗ Dependency: backlog   (grå)
  └─ Tooltip (?): "Task kan ikke auto-starte (todo) før denne task er done."
```

Props til sidebar: tilføj `allTasks: { id: string; title: string; status: string }[]` (tasks fra samme business).

---

### T4.4 — PR-link felt i task sidebar

**Nye filer:**
- `components/tasks/task-pr-link-form.tsx` — inline form
- Ny Server Action i `lib/tasks/actions.ts`

**Server Action:**

```typescript
export async function updateTaskPrLink(
  taskId: string,
  input: { githubPrNumber: number | null; githubRepoInstallationId: string | null }
): Promise<void>
```

Guards:
- `assertTaskInBusinessForUser`.
- Hvis `githubPrNumber` sat: verify positivt heltal.
- Hvis `githubRepoInstallationId` sat: verify at installation tilhører task's business.
- Begge felter skal enten begge være sat eller begge null (ingen halvt link).

**Komponent `task-pr-link-form.tsx`:**

```
Sektion: "Pull Request"
  ├─ Dropdown: "Repository" — viser github_installations for business
  │    Options: { label: "owner/repo", value: installationId }
  ├─ Input: "PR nummer" (type=number, min=1, placeholder="1234")
  └─ Gem-knap
  
Under felterne (når prStatus er sat):
  └─ <TaskPrBadge status={task.githubPrStatus} />  ← fra S3 T3.3
     (hvis S3 ikke er merget endnu: vis ingenting her — badge er en peer-dependency)
```

OBS: `TaskPrBadge` importeres med optional chaining / conditional import — S3 er et parallelt spor. Hvis komponenten ikke eksisterer endnu: vis blot tekst-status i stedet.

---

### T4.5 — `todo` status i task UI

Find alle steder i kodebasen hvor task-statusser vises eller vælges og tilføj `todo`:

1. **Status-farve mapping** (find konstant eller inline styles for statusser):
   - `todo` → **lys indigo/lilla** (adskilt fra `in_progress` som typisk er blå)

2. **Status-labels** (find label-mapping):
   - `todo` → `"Todo"`

3. **Status-dropdown** (task-detail og evt. task-oprettelse):
   - Tilføj `todo` i korrekt rækkefølge: efter `backlog`, før `in_progress`.
   - Tooltip på `todo`-option: *"Agent starter automatisk når gates er grønne."*

4. Søg i `components/tasks/` og `lib/tasks/` efter `'backlog' | 'in_progress'` eller lignende union-types og tilføj `'todo'`.

---

### T4.6 — Gate-status indikator

**Ny fil:** `components/tasks/task-gate-status.tsx`

```typescript
"use client";

type GateStatusProps = {
  dependencyTask: { status: string; title: string } | null;
  prMergedToIntegration: boolean;
  githubPrStatus: string | null;
  githubPrNumber: number | null;
  integrationBranch: string | null; // fra business settings
};

export function TaskGateStatus(props: GateStatusProps)
```

**Visningslogik:**

Vis kun når task har `status === 'todo' || status === 'backlog'` og mindst ét gate-felt er sat.

```
Gate-status:
  ✓ Dependency: done            ← grøn check
  ⧗ PR #1234: afventer merge til staging  ← gul timer
  → Gates: ikke klar            ← rød/grå tekst

— eller når alt er grønt —

  ✓ Dependency: done
  ✓ PR #1234: merged til staging
  → Gates: klar — agent starter snart
```

Komponenten er **ren UI** (ingen Server Actions) — den modtager data som props og beregner gate-status lokalt:

```typescript
const depOk = !props.dependencyTask || props.dependencyTask.status === "done";
const prOk = !props.githubPrNumber || props.prMergedToIntegration;
const gatesReady = depOk && prOk;
```

Render komponenten i `task-detail-client.tsx` eller `task-detail-sidebar.tsx` — vælg det sted der giver mest mening ud fra eksisterende layout.

---

## Test-krav

**Fil:** `lib/tasks/__tests__/promotion-auth.test.ts` (ny)

```typescript
describe("assertMayPromoteToTodo", () => {
  it("allows human callers unconditionally")
  it("allows agent with system_role.mayPromoteBacklogToTodo=true")
  it("allows agent that is leadAgentId on task's team")
  it("rejects agent with worker role (no promotion flag)")
  it("rejects agent from different business")
  it("rejects when task has no team and agent has no promotion flag")
})
```

**Fil:** `lib/tasks/__tests__/task-actions-s4.test.ts` (ny)

```typescript
describe("updateTaskDependency", () => {
  it("accepts null (clear dependency)")
  it("rejects self-dependency (taskId === dependencyTaskId)")
  it("rejects dependency from different business")
})

describe("updateTaskPrLink", () => {
  it("accepts valid prNumber + installationId")
  it("rejects negative PR numbers")
  it("rejects when only one of prNumber/installationId is set")
  it("rejects installationId from different business")
  it("accepts null/null (clear link)")
})
```

Kør: `npm test lib/tasks/__tests__/promotion-auth.test.ts lib/tasks/__tests__/task-actions-s4.test.ts`  
Kør herefter: `npm test` — alle eksisterende tests skal forblive grønne.

---

## Commit-disciplin

```
feat(tasks): add promoteTaskToTodo server action (T4.1)
feat(tasks): add promotion authorization with RBAC (T4.2)
feat(tasks): add dependency picker in task sidebar (T4.3)
feat(tasks): add PR link form in task sidebar (T4.4)
feat(tasks): add todo status to task UI with correct color and tooltip (T4.5)
feat(tasks): add gate status indicator component (T4.6)
test(tasks): promotion auth and task action validation tests
```

Push efter hvert commit: `git push origin feat/task-lifecycle`

---

## Hvad du IKKE må gøre

- Ændre `db/schema.ts` — S1 er done.
- Køre `db:generate` eller `db:migrate`.
- Ændre `app/api/github/` filer — tilhører S3.
- Ændre `app/dashboard/settings/` filer — tilhører S2.
- Ændre `runner/` filer — tilhører S5.
- Merge til `main` — PR er draft.

---

## Vigtig note om peer-dependencies

**`TaskPrBadge`** (fra S3 T3.3) bruges i T4.4. Hvis S3 ikke er merget endnu når du implementerer:

```typescript
// Brug conditional import eller simpel fallback:
import { TaskPrBadge } from "@/components/tasks/task-pr-badge";
// Hvis filen ikke eksisterer endnu — opret en minimal stub:
// export function TaskPrBadge({ status }: { status: string | null }) {
//   if (!status) return null;
//   return <span className="text-xs text-muted-foreground">{status}</span>;
// }
```

S3-agenten ejer den "rigtige" implementation — din stub erstattes når S3 merges.

---

## Afslutning — din rapport skal indeholde

1. PR-URL.
2. Liste over commits med hash.
3. Output af `npm test` (grøn).
4. Liste over alle steder du tilføjede `todo` til status-unions/-mappings.
5. Beskrivelse af peer-dependency-håndtering for `TaskPrBadge`.
6. Eventuelle afvigelser fra task-plan med begrundelse.
