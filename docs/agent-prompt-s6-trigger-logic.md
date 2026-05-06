# Agent Prompt — S6: Trigger-logik (kommentarer & gates)

> **Til agenten:** Læs denne prompt i sin helhed før du rører én fil. Følg **Git-disciplin** præcist — ingen undtagelser.

---

## Dit opdrag

Du skal implementere **S6 — Trigger-logik** fra:

- **PRD:** `docs/prd-autonomous-agent-flow-v1.md` — F3 (auto-trigger fra todo), F4 (kommentar-routing)
- **Task-plan:** `docs/tasks-autonomous-agent-flow-v1.md` — afsnittet **S6**, T6.1–T6.3

S6 kører **parallelt** med S5. Du leverer **gate-evaluering, kommentar-routing og auto-trigger** — det er den intelligens der beslutter hvornår en agent rent faktisk skal starte. S7 bruger din gate-evaluerings-funktion.

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
git worktree add ../ai-business-s6-triggers feat/trigger-logic
cd ../ai-business-s6-triggers
```

Alt arbejde foregår i `../ai-business-s6-triggers`. Commit aldrig direkte til `main`.

### Trin 3 — Opret Draft PR med det samme (inden du koder)

```bash
cd ../ai-business-s6-triggers
gh pr create \
  --title "feat: trigger logic — comment routing, gate evaluation, auto-trigger from todo (S6)" \
  --body "## S6 — Trigger-logik

Implementerer kommentar-routing, AND-gate evaluering og auto-trigger når todo-tasks er klar.

**PRD:** docs/prd-autonomous-agent-flow-v1.md (F3, F4)
**Tasks:** docs/tasks-autonomous-agent-flow-v1.md#s6

### Ændringer
- [ ] T6.1 — Kommentar-routing (ingen mention → worker; mention → alle nævnte)
- [ ] T6.2 — Gate-evaluerings-funktion (dependency AND PR-merge)
- [ ] T6.3 — Auto-trigger fra todo (ved promotion + ved gate åbner)
- [ ] TX4 — Ryd op i eksisterende mention_trigger pending events

### Test
- [ ] npm test grøn
- [ ] Kommentar-routing: alle 4 mention-scenarier
- [ ] Gate: alle kombinationer (ingen, dep kun, PR kun, begge)
- [ ] Auto-trigger: idempotency via gatesLockedAt

## Quality gate
🟡 Yellow — S6 leverer til S7 (heartbeat bruger evaluateTaskGates)." \
  --draft \
  --base main
```

---

## Kontekst du skal læse FØR implementering

1. `lib/tasks/mention-trigger.ts` — eksisterende implementering (du omskriver denne)
2. `lib/tasks/log-actions.ts` — `appendTaskLog` der kalder `parseAndTriggerMentions` (du opdaterer kaldet)
3. `lib/tasks/actions.ts` — `promoteTaskToTodo`, `updateTaskStatus` (du tilhægter hooks her)
4. `lib/orchestration/events.ts` — `logEvent` funktion
5. `db/schema.ts` — `tasks`, `orchestrationEvents`, `agents` (forstå nye S1-felter: `dependencyTaskId`, `githubPrNumber`, `prMergedToIntegration`, `gatesLockedAt`, `status`)
6. `docs/prd-autonomous-agent-flow-v1.md` — F3 (gate-logik), F4 (kommentar-routing regler)

Læs **ikke** `node_modules`, `.next`, `drizzle/`, `runner/`.

---

## Implementeringsopgaver

### T6.1 — Kommentar-routing (omskriv mention-trigger)

**Fil:** `lib/tasks/mention-trigger.ts` — **omskriv fuldstændigt**

Den nuværende implementering opretter `mention_trigger` events. Vi migrerer til `webhook_trigger` med mention-payload (se PRD F9 + S5 T5.3).

#### Ny routing-logik

Reglerne er (fra PRD F4):
1. **Ingen `@mention` i tekst + task har `agentId`** → trigger **assignet worker**
2. **Ingen `@mention` + ingen assignet agent** → gør intet
3. **En eller flere `@mention`** → trigger **alle eksplicit nævnte agenter** (uanset om de er worker)

```typescript
/**
 * Routes a human comment to the correct agent(s) via webhook_trigger events.
 *
 * Rules:
 * - No @mentions + task has assignedAgentId → trigger assigned agent
 * - @mentions present → trigger all matched agents (may include assigned agent if mentioned)
 * - No mentions + no assigned agent → no-op
 */
export async function routeCommentToAgents(
  taskId: string,
  logContent: string,
  businessId: string,
  assignedAgentId: string | null,
): Promise<void>
```

**Implementering:**

```typescript
const handles = extractMentionHandles(logContent); // genbruges fra eksisterende

if (handles.length === 0) {
  // Ingen mention — trigger kun assigned worker hvis der er én
  if (!assignedAgentId) return;
  await logEvent({
    type: "webhook_trigger",
    businessId,
    payload: {
      agentId: assignedAgentId,
      taskId,
      trigger: "comment_no_mention",
      excerpt: logContent.slice(0, 200),
    },
    status: "pending",
  });
  return;
}

// Mentions fundet — trigger alle matchede agenter
const db = getDb();
const notified = new Set<string>();

for (const handle of handles) {
  const matches = await db.query.agents.findMany({
    where: and(
      eq(agents.businessId, businessId),
      sql`lower(${agents.name}) = lower(${handle})`,
    ),
    columns: { id: true },
  });

  for (const agent of matches) {
    if (notified.has(agent.id)) continue;
    notified.add(agent.id);
    await logEvent({
      type: "webhook_trigger",
      businessId,
      payload: {
        agentId: agent.id,
        taskId,
        trigger: "comment_mention",
        mentionedHandle: handle,
        excerpt: excerptAroundMention(logContent, handle),
      },
      status: "pending",
    });
  }
}
```

**Behold** de eksisterende hjælpefunktioner `extractMentionHandles` og `excerptAroundMention` uændret.

**Opdater `lib/tasks/log-actions.ts`** — erstat kaldet til `parseAndTriggerMentions`:

```typescript
// FØR:
await parseAndTriggerMentions(taskId, trimmed, task.businessId);

// EFTER:
await routeCommentToAgents(taskId, trimmed, task.businessId, task.agentId ?? null);
```

Hent `task.agentId` i den eksisterende DB-query i `appendTaskLog`.

**Test:** `lib/tasks/__tests__/mention-trigger.test.ts` — **omskriv** eksisterende tests:

```typescript
describe("routeCommentToAgents", () => {
  it("creates webhook_trigger for assigned agent when no mentions")
  it("does nothing when no mentions and no assigned agent")
  it("creates webhook_trigger for each mentioned agent")
  it("creates webhook_trigger for worker if explicitly @mentioned alongside others")
  it("deduplicates if same agent matched by multiple handles")
  it("does NOT trigger assigned agent when others are mentioned (no extra event)")
})
```

---

### T6.2 — Gate-evaluerings-funktion

**Ny fil:** `lib/tasks/gate-evaluator.ts`

```typescript
import { getDb } from "@/db/index";
import { tasks } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface GateResult {
  ready: boolean;
  dependencyOk: boolean;
  prOk: boolean;
  reasons: string[]; // human-readable årsager til NOT ready
}

/**
 * Evaluerer om en tasks gates er opfyldt for auto-start.
 *
 * Gate-logik (AND når begge sat):
 *   dependency_ok = dependencyTaskId IS NULL || dependency.status === 'done'
 *   pr_ok         = githubPrNumber IS NULL   || prMergedToIntegration === true
 *   ready         = dependency_ok && pr_ok
 */
export async function evaluateTaskGates(taskId: string): Promise<GateResult>
```

**Implementering:**

```typescript
const db = getDb();

const task = await db.query.tasks.findFirst({
  where: eq(tasks.id, taskId),
  columns: {
    dependencyTaskId: true,
    githubPrNumber: true,
    prMergedToIntegration: true,
  },
});

if (!task) throw new Error(`Task ${taskId} not found`);

const reasons: string[] = [];
let dependencyOk = true;
let prOk = true;

// Dependency gate
if (task.dependencyTaskId) {
  const dep = await db.query.tasks.findFirst({
    where: eq(tasks.id, task.dependencyTaskId),
    columns: { status: true, title: true },
  });
  if (!dep || dep.status !== "done") {
    dependencyOk = false;
    reasons.push(`Dependency task "${dep?.title ?? task.dependencyTaskId}" is not done (status: ${dep?.status ?? "not found"})`);
  }
}

// PR merge gate
if (task.githubPrNumber !== null && task.githubPrNumber !== undefined) {
  if (!task.prMergedToIntegration) {
    prOk = false;
    reasons.push(`PR #${task.githubPrNumber} has not been merged to integration branch`);
  }
}

const ready = dependencyOk && prOk;

return { ready, dependencyOk, prOk, reasons };
```

**Test:** `lib/tasks/__tests__/gate-evaluator.test.ts`

```typescript
describe("evaluateTaskGates", () => {
  it("returns ready=true when no gates are set")
  it("returns ready=true when dependency is done and no PR")
  it("returns ready=false when dependency is not done")
  it("returns ready=true when PR is merged and no dependency")
  it("returns ready=false when PR is not merged")
  it("returns ready=true when both dependency done AND PR merged")
  it("returns ready=false when dependency ok but PR not merged")
  it("returns ready=false when PR ok but dependency not done")
  it("includes human-readable reasons when not ready")
})
```

---

### T6.3 — Auto-trigger fra todo

**Ny fil:** `lib/tasks/auto-trigger.ts`

```typescript
import { getDb } from "@/db/index";
import { tasks, orchestrationEvents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { evaluateTaskGates } from "./gate-evaluator";
import { logEvent } from "@/lib/orchestration/events";

/**
 * Evaluerer gates for en todo-task og opretter webhook_trigger hvis klar.
 * Idempotent: bruger gatesLockedAt som guard mod dobbelt-trigger.
 */
export async function maybeAutoTriggerTask(taskId: string): Promise<{ triggered: boolean; reasons?: string[] }>
```

**Implementering:**

```typescript
const db = getDb();

const task = await db.query.tasks.findFirst({
  where: eq(tasks.id, taskId),
  columns: {
    status: true,
    businessId: true,
    agentId: true,
    gatesLockedAt: true,
  },
});

if (!task) return { triggered: false };

// Kun todo-tasks kan auto-triggers
if (task.status !== "todo") return { triggered: false };

// Idempotency: allerede trigget
if (task.gatesLockedAt !== null) return { triggered: false };

const gates = await evaluateTaskGates(taskId);
if (!gates.ready) return { triggered: false, reasons: gates.reasons };

// Sæt gatesLockedAt som idempotency guard
await db.update(tasks)
  .set({ gatesLockedAt: new Date(), updatedAt: new Date() })
  .where(and(eq(tasks.id, taskId), eq(tasks.gatesLockedAt, null))); // optimistic lock

// Dobbelttjek vi vandt optimistic lock
const updated = await db.query.tasks.findFirst({
  where: eq(tasks.id, taskId),
  columns: { gatesLockedAt: true },
});
if (!updated?.gatesLockedAt) return { triggered: false }; // anden process vandt

// Opret webhook_trigger
await logEvent({
  type: "webhook_trigger",
  businessId: task.businessId,
  payload: {
    taskId,
    agentId: task.agentId ?? undefined,
    trigger: "auto_todo",
  },
  status: "pending",
});

return { triggered: true };
```

**Hook ind i eksisterende flow — 3 steder:**

**1. Efter `promoteTaskToTodo` i `lib/tasks/actions.ts`:**
```typescript
// Tilføj sidst i promoteTaskToTodo:
await maybeAutoTriggerTask(taskId);
```

**2. I `lib/tasks/actions.ts` — `updateTaskStatus`:**
```typescript
// Når en dependency-task sættes til 'done':
// Find alle todo-tasks der peger på denne task og evaluer deres gates
if (status === "done") {
  const dependents = await db.query.tasks.findMany({
    where: and(
      eq(tasks.dependencyTaskId, taskId),
      eq(tasks.status, "todo"),
    ),
    columns: { id: true },
  });
  for (const dep of dependents) {
    await maybeAutoTriggerTask(dep.id);
  }
}
```

**3. I GitHub webhook-handler `lib/github/pr-webhook-handler.ts` — efter `prMergedToIntegration = true`:**
```typescript
// Allerede i S3 — tilføj efter tasks er opdateret:
for (const task of matchingTasks) {
  if (isMergedToIntegration) {
    await maybeAutoTriggerTask(task.id);
  }
}
```

**Test:** `lib/tasks/__tests__/auto-trigger.test.ts`

```typescript
describe("maybeAutoTriggerTask", () => {
  it("does nothing for non-todo tasks")
  it("does nothing when gatesLockedAt is already set (idempotency)")
  it("does nothing when gates are not ready")
  it("creates webhook_trigger and sets gatesLockedAt when gates are ready")
  it("handles optimistic lock collision gracefully")
  it("includes agentId in payload when task has assignedAgent")
})
```

---

### TX4 — Ryd op i eksisterende mention_trigger pending events

**Ny fil:** `scripts/cleanup-mention-triggers.ts`

```typescript
import { getDb } from "@/db/index";
import { orchestrationEvents } from "@/db/schema";
import { and, eq } from "drizzle-orm";

async function main() {
  const db = getDb();
  const result = await db
    .update(orchestrationEvents)
    .set({
      status: "failed",
      payload: {
        runnerError: "Deprecated: mention_trigger migrated to webhook_trigger (S6 cleanup)",
      },
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orchestrationEvents.type, "mention_trigger"),
        eq(orchestrationEvents.status, "pending"),
      ),
    )
    .returning({ id: orchestrationEvents.id });

  console.log(`Cleaned up ${result.length} stale mention_trigger events.`);
}

main().catch(console.error);
```

Tilføj npm-script i `package.json`:
```json
"db:cleanup-mention-triggers": "npx tsx scripts/cleanup-mention-triggers.ts"
```

Kør det **efter PR er merget**: `npm run db:cleanup-mention-triggers`

---

## Commit-disciplin

```
feat(tasks): rewrite comment routing — no-mention triggers worker, mentions trigger all named (T6.1)
feat(tasks): add gate evaluator with AND logic for dependency and PR merge (T6.2)
feat(tasks): add auto-trigger from todo with optimistic idempotency (T6.3)
feat(tasks): hook auto-trigger into promoteTaskToTodo and updateTaskStatus (T6.3)
chore(scripts): add cleanup script for stale mention_trigger events (TX4)
test(tasks): comment routing, gate evaluator and auto-trigger tests
```

Push efter hvert commit: `git push origin feat/trigger-logic`

---

## Hvad du IKKE må gøre

- Ændre `runner/` filer direkte — S5 ejer runner. Du må **kalde** `logEvent` men ikke ændre dispatch-logik.
- Ændre `db/schema.ts` — S1 er done.
- Køre `db:generate` eller `db:migrate`.
- Slette `extractMentionHandles` — den genbruges og bruges i tests.
- Merge til `main` — PR er draft.

---

## Vigtig note om peer-dependency på S5

S5 udvidede `runner/dispatch.ts` til at håndtere `mention_trigger` events. Dit arbejde her **producerer** `webhook_trigger` events i stedet for `mention_trigger`. Sørg for at dine tests mocke `logEvent` og ikke er afhængige af runner-implementering — de to spor er løst koblet via DB-events.

---

## Afslutning — din rapport skal indeholde

1. PR-URL.
2. Liste over commits med hash.
3. Output af `npm test` (grøn).
4. Bekræftelse: ingen `mention_trigger` events oprettes længere.
5. Bekræftelse: `gatesLockedAt` bruges korrekt som idempotency guard.
6. Eventuelle afvigelser med begrundelse.
