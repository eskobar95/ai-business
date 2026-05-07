# Agent Prompt — S7: Lead Heartbeat (fuldt autonomt flow)

> **Dette er den vigtigste sektion. Læs den 3 gange, og udfør hvert trin i rækkefølge — ingen undtagelser.**

---

## ⚠️ GIT-DISCIPLIN — OBLIGATORISK STARTPROTOKOL

**Du må ikke røre en eneste kodefil, før du har gennemført alle 4 trin herunder.**

### Trin 1 — Verificer at din arbejdsmappe er ren og på main

```bash
git status
```

Forventet output:
```
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

Hvis du ser NOGET andet — stop og rapporter. Forsæt ikke.

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
```

Bekræft igen med `git status` — skal vise "nothing to commit, working tree clean".

---

### Trin 2 — Hvad er en git worktree, og hvorfor bruger vi den?

En **git worktree** er en separat mappe på disken der peger på en bestemt branch i dit repository — men uden at du behøver at skifte branch i din primære mappe. Det betyder:

- Din primære mappe (`ai-business/`) forbliver på `main`.
- Alt dit arbejde foregår i en isoleret mappe (`../ai-business-s7-heartbeat/`).
- Du commit'er og push'er fra worktree-mappen, ikke fra den primære.
- Når PR'en er merget, sletter en anden agent worktreen — du skal ikke gøre det selv.

**Vigtigt:** Du må **kun** arbejde i din worktree-mappe (`../ai-business-s7-heartbeat/`). Kør aldrig `git commit` eller `git push` fra `ai-business/`.

---

### Trin 3 — Opret din feature-branch og worktree

Kør fra `C:/Users/Nicklas/Github/ai-business` (den primære repo-rod):

```bash
git worktree add ../ai-business-s7-heartbeat feat/lead-heartbeat
```

Dette opretter:
- En ny lokal branch `feat/lead-heartbeat` (baseret på `main`)
- En ny mappe `../ai-business-s7-heartbeat/` der er tjekket ud på den branch

Skift nu til din worktree-mappe:

```bash
cd ../ai-business-s7-heartbeat
```

Bekræft at du er korrekt placeret:

```bash
git branch
# Skal vise: * feat/lead-heartbeat

pwd
# Skal vise: .../ai-business-s7-heartbeat
```

**Du må aldrig `cd` tilbage til `ai-business/` og commit derfra.**

---

### Trin 4 — Opret Draft PR MED DET SAMME (inden du skriver én linje kode)

Fra din worktree-mappe (`../ai-business-s7-heartbeat`):

```bash
git commit --allow-empty -m "chore: init S7 lead-heartbeat branch"
git push -u origin feat/lead-heartbeat

gh pr create \
  --title "feat: lead heartbeat — autonomous backlog promotion and scheduler (S7)" \
  --body "## S7 — Lead Heartbeat

Implementerer fuldt autonomt flow: lead-agent kører heartbeat der automatisk promoverer backlog-tasks til todo baseret på gates og cap.

**PRD:** docs/prd-autonomous-agent-flow-v1.md (F1, F2, F5, F6)
**Tasks:** docs/tasks-autonomous-agent-flow-v1.md#s7

### Ændringer
- [ ] T7.1 — runner/lead-heartbeat.ts (dispatcher — erstatter stub)
- [ ] T7.2 — runner/lead-heartbeat-prompt.ts (prompt-builder med sprint-context)
- [ ] T7.3 — lib/heartbeat/actions.ts (runsHeartbeat flag-check)
- [ ] T7.4 — runner/poll.ts (scheduler: opret lead_heartbeat events automatisk)

### Test
- [ ] npm test grøn
- [ ] heartbeat cap overholdes: max N promotioner pr. tick
- [ ] idempotency: samme task promoveres ikke to gange

## Quality gate
🟡 Yellow — S7 afslutter det autonome flow; kræver manuel smoke-test af end-to-end." \
  --draft \
  --base main
```

Du skulle nu se: `https://github.com/eskobar95/ai-business/pull/...`

**Gem PR-URL'en. Du rapporterer den til sidst.**

Nu — og kun nu — må du begynde at kode.

---

## Dit opdrag

Du implementerer **S7 — Lead Heartbeat**, det sidste spor der lukker det fuldt autonome agent-flow.

**Hvad du bygger:** Lead-agenten kører periodisk (via runner's poll-loop). Den ser på business'ens backlog, evaluerer hvilke tasks der kan startes (gates opfyldt, ingen blocking dependencies), og promoverer op til N tasks til `todo` status. `todo`-status trigger automatisk den assignerede worker-agent (via S6's auto-trigger logik der allerede er implementeret).

**Hvad der allerede er bygget og IKKE skal røres:**
- `runner/poll.ts` — har allerede mutex, parallel-cap og `lead_heartbeat`-skipping af API-key check.
- `runner/dispatch.ts` — har allerede en **stub** for `lead_heartbeat` (linje der kalder `finishOrchestrationEvent` med `stub: true`). **Du erstatter denne stub med den rigtige implementering.**
- `lib/tasks/auto-trigger.ts` — `maybeAutoTriggerTask()` er klar og fungerer.
- `lib/tasks/gate-evaluator.ts` — `evaluateTaskGates()` er klar og fungerer.
- `lib/tasks/actions.ts` — `promoteTaskToTodo()` er klar og fungerer.
- `runner/readiness-check.ts` — `assertBusinessReadyForExecution()` er klar.
- `runner/cursor-config-resolver.ts` — `resolveCursorConfig()` er klar.

---

## Kontekst du SKAL læse inden du koder

Læs disse filer i rækkefølge. Brug Read-tool — læs ikke blindt fra hukommelsen.

1. `runner/dispatch.ts` — find `lead_heartbeat` stubben du skal erstatte
2. `runner/poll.ts` — forstå hele poll-loop og hvor du tilhægter scheduler
3. `runner/queries.ts` — tilgængelige DB-queries (du tilføjer nye her)
4. `runner/prompt-builder.ts` — eksisterende prompt-builder (inspiration til struktur)
5. `lib/heartbeat/actions.ts` — eksisterende `runHeartbeat` Server Action
6. `lib/heartbeat/prompt-builder.ts` — eksisterende heartbeat prompt-builder
7. `lib/tasks/actions.ts` — `promoteTaskToTodo` signaturen
8. `db/schema.ts` — `agents`, `systemRoles`, `tasks`, `teams`, `businesses`
9. `docs/prd-autonomous-agent-flow-v1.md` — F1 (autonomt flow), F5 (heartbeat cap), F6 (scheduler)

Læs **ikke** `node_modules`, `.next`, `drizzle/`, `runner/_archived/`.

---

## Implementeringsopgaver

### T7.1 — Lead heartbeat dispatcher

**Ny fil:** `runner/lead-heartbeat.ts`

Dette er den centrale fil. Den **erstatter** stubben i `runner/dispatch.ts`.

```typescript
import { Agent } from "@cursor/sdk";
import { getDb } from "@/db/index";
import { agents, businesses, systemRoles, tasks, teams } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { runnerLog, runnerLogError } from "./logger";
import { assertBusinessReadyForExecution } from "./readiness-check";
import { resolveCursorConfig } from "./cursor-config-resolver";
import { finishOrchestrationEvent } from "./queries";
import { buildLeadHeartbeatPrompt } from "./lead-heartbeat-prompt";
import { promoteTaskToTodo } from "@/lib/tasks/actions";

export async function dispatchLeadHeartbeat(
  eventId: string,
  event: { businessId: string | null; payload: Record<string, unknown> },
  apiKey: string,
): Promise<void>
```

**Implementeringsflow (i rækkefølge):**

```typescript
const businessId = event.businessId;
if (!businessId) {
  await finishOrchestrationEvent(eventId, {
    status: "failed",
    payload: { ...event.payload, runnerError: "lead_heartbeat requires businessId" },
  });
  return;
}

const db = getDb();

// 1. Hent business + localPath
const business = await db.query.businesses.findFirst({
  where: eq(businesses.id, businessId),
  columns: { localPath: true, integrationBranch: true },
});

// 2. Readiness gate
try {
  await assertBusinessReadyForExecution(businessId, business?.localPath ?? null);
} catch (e) {
  await finishOrchestrationEvent(eventId, {
    status: "failed",
    payload: { ...event.payload, runnerError: e instanceof Error ? e.message : String(e) },
  });
  return;
}

// 3. Find lead-agent (har runsHeartbeat = true + er i dette business)
const leadAgent = await findLeadAgentForBusiness(businessId, db);
if (!leadAgent) {
  await finishOrchestrationEvent(eventId, {
    status: "failed",
    payload: { ...event.payload, runnerError: "No agent with runsHeartbeat=true found for business." },
  });
  return;
}

// 4. Hent backlog-tasks der potentielt kan promoveres
const backlogTasks = await getPromotableCandidates(businessId, db);

// 5. Byg prompt
const prompt = await buildLeadHeartbeatPrompt({
  agentId: leadAgent.id,
  businessId,
  backlogTasks,
});

// 6. Cursor-config (ingen API-key for lead_heartbeat — apiKey er "" — men model resolver kører)
const cursorConfig = await resolveCursorConfig(leadAgent.id, businessId);

// 7. Kør Cursor SDK
const localPath = business!.localPath!.trim();
let agentSdk: import("@cursor/sdk").SDKAgent | null = null;

try {
  agentSdk = await Agent.create({
    apiKey: apiKey || process.env.CURSOR_API_KEY || "",
    ...(cursorConfig.modelId ? { model: { id: cursorConfig.modelId } } : {}),
    local: { cwd: localPath },
  });

  const run = await agentSdk.send(prompt);
  const messages: import("@cursor/sdk").SDKAssistantMessage[] = [];

  for await (const msg of run.stream()) {
    if (msg && typeof msg === "object" && "role" in msg && msg.role === "assistant") {
      messages.push(msg as import("@cursor/sdk").SDKAssistantMessage);
    }
  }

  await run.wait();

  // 8. Parse output for JSON-promotions
  const promotions = parseLeadOutput(messages);
  const cap = leadAgent.heartbeatPromotionCap ?? 3;
  const toPromote = promotions.slice(0, cap);

  runnerLog("runner/lead-heartbeat", `Lead ${leadAgent.name} wants to promote ${promotions.length} tasks; cap=${cap} → promoting ${toPromote.length}`);

  // 9. Promover tasks (maybeAutoTriggerTask kaldes inde i promoteTaskToTodo)
  const promoted: string[] = [];
  const errors: string[] = [];

  for (const taskId of toPromote) {
    try {
      await promoteTaskToTodo(taskId, leadAgent.id);
      promoted.push(taskId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${taskId}: ${msg}`);
      runnerLogError("runner/lead-heartbeat", `Failed to promote task ${taskId}:`, msg);
    }
  }

  await finishOrchestrationEvent(eventId, {
    status: "succeeded",
    payload: {
      ...event.payload,
      leadAgentId: leadAgent.id,
      candidatesFound: backlogTasks.length,
      promotionsRequested: promotions.length,
      promotionsCapped: toPromote.length,
      promoted,
      errors,
    },
  });

} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  runnerLogError("runner/lead-heartbeat", "Lead heartbeat failed:", message);
  await finishOrchestrationEvent(eventId, {
    status: "failed",
    payload: { ...event.payload, runnerError: message },
  });
} finally {
  if (agentSdk) {
    try { agentSdk.close(); } catch { /* ignore */ }
  }
}
```

**Hjælpefunktioner i samme fil:**

```typescript
async function findLeadAgentForBusiness(businessId: string, db: ReturnType<typeof getDb>) {
  // Find agent med runsHeartbeat=true via system_role join
  const result = await db
    .select({ id: agents.id, name: agents.name, heartbeatPromotionCap: agents.heartbeatPromotionCap })
    .from(agents)
    .innerJoin(systemRoles, eq(agents.systemRoleId, systemRoles.id))
    .where(and(eq(agents.businessId, businessId), eq(systemRoles.runsHeartbeat, true)))
    .limit(1);
  return result[0] ?? null;
}

async function getPromotableCandidates(businessId: string, db: ReturnType<typeof getDb>) {
  // Backlog-tasks assigneret til denne business, med gate-info
  return db.query.tasks.findMany({
    where: and(
      eq(tasks.businessId, businessId),
      eq(tasks.status, "backlog"),
    ),
    columns: {
      id: true,
      title: true,
      description: true,
      dependencyTaskId: true,
      githubPrNumber: true,
      prMergedToIntegration: true,
      agentId: true,
    },
  });
}

/**
 * Parses lead-agent output for a JSON list of task IDs to promote.
 * Expects the agent to output a JSON block like:
 * ```json
 * { "promote": ["uuid-1", "uuid-2"] }
 * ```
 * Falls back to empty array if output can't be parsed — never throws.
 */
function parseLeadOutput(messages: import("@cursor/sdk").SDKAssistantMessage[]): string[] {
  const fullText = messages
    .flatMap((m) => {
      const c = m.content;
      return Array.isArray(c)
        ? c.filter((b): b is { type: "text"; text: string } => typeof b === "object" && b !== null && "type" in b && b.type === "text").map((b) => b.text)
        : typeof c === "string"
        ? [c]
        : [];
    })
    .join("\n");

  // Find JSON block
  const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    // Fallback: try to find raw { "promote": [...] }
    const rawMatch = fullText.match(/\{\s*"promote"\s*:\s*\[([\s\S]*?)\]/);
    if (!rawMatch) return [];
    try {
      const parsed = JSON.parse(`{"promote":[${rawMatch[1]}]}`);
      return Array.isArray(parsed.promote) ? parsed.promote.filter((x: unknown) => typeof x === "string") : [];
    } catch { return []; }
  }
  try {
    const parsed = JSON.parse(jsonMatch[1].trim());
    return Array.isArray(parsed.promote) ? parsed.promote.filter((x: unknown) => typeof x === "string") : [];
  } catch { return []; }
}
```

---

### T7.2 — Lead heartbeat prompt-builder

**Ny fil:** `runner/lead-heartbeat-prompt.ts`

```typescript
import { getDb } from "@/db/index";
import { agents, agentDocuments, businesses, tasks, systemRoles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getLatestBusinessMemoryContent } from "./queries";

export interface LeadHeartbeatPromptInput {
  agentId: string;
  businessId: string;
  backlogTasks: Array<{
    id: string;
    title: string;
    description: string | null;
    dependencyTaskId: string | null;
    githubPrNumber: number | null;
    prMergedToIntegration: boolean;
    agentId: string | null;
  }>;
}

export async function buildLeadHeartbeatPrompt(input: LeadHeartbeatPromptInput): Promise<string>
```

**Prompt-sektioner (i rækkefølge):**

```typescript
const db = getDb();

// Hent agent-soul + business memory parallelt
const [agentRow, memory] = await Promise.all([
  db.query.agents.findFirst({
    where: eq(agents.id, input.agentId),
    columns: { name: true, role: true },
    with: {
      agentDocuments: {
        limit: 1,
        orderBy: (d, { desc }) => [desc(d.updatedAt)],
        columns: { content: true },
      },
    },
  }),
  getLatestBusinessMemoryContent(input.businessId),
]);

const soul = agentRow?.agentDocuments?.[0]?.content ?? "(No soul document found)";
const agentName = agentRow?.name ?? "Lead Agent";

// Format backlog tasks
const taskLines = input.backlogTasks.map((t) => {
  const gates: string[] = [];
  if (t.dependencyTaskId) gates.push(`depends on task ${t.dependencyTaskId}`);
  if (t.githubPrNumber && !t.prMergedToIntegration) gates.push(`PR #${t.githubPrNumber} not merged`);
  const gateStr = gates.length > 0 ? ` [BLOCKED: ${gates.join("; ")}]` : " [READY]";
  const assignee = t.agentId ? `assigned:${t.agentId.slice(0, 8)}` : "unassigned";
  return `- id:${t.id} | ${t.title}${gateStr} | ${assignee}`;
}).join("\n");

const sections = [
  `# ${agentName} — Lead Heartbeat`,
  "",
  "## Your role",
  soul,
  "",
  "## Business context",
  memory ?? "(No business memory found)",
  "",
  "## Current backlog (candidates for promotion to todo)",
  taskLines || "(No backlog tasks found)",
  "",
  "## Your task",
  "Review the backlog above. Identify which tasks are READY (not blocked) and should be started now.",
  "Consider task dependencies and agent capacity.",
  "Return a JSON block with the task IDs you recommend promoting to 'todo' status.",
  "",
  "IMPORTANT: Only return tasks marked [READY]. Never return tasks marked [BLOCKED].",
  "Return at most the number specified by your heartbeat cap (the system enforces it, but be conservative).",
  "",
  "Respond with ONLY this JSON block and a brief rationale:",
  "```json",
  '{ "promote": ["task-id-1", "task-id-2"] }',
  "```",
];

return sections.join("\n");
```

**Test:** `runner/__tests__/lead-heartbeat-prompt.test.ts`

```typescript
describe("buildLeadHeartbeatPrompt", () => {
  it("marks tasks with dependencies as BLOCKED")
  it("marks tasks with unmerged PRs as BLOCKED")
  it("marks tasks with no gates as READY")
  it("includes agent soul and business memory in output")
  it("returns empty promote array when no backlog")
})
```

---

### T7.3 — Erstatt stubben i dispatch.ts

**Fil:** `runner/dispatch.ts`

Find den eksisterende `lead_heartbeat` stub:
```typescript
if (event.type === "lead_heartbeat") {
  await finishOrchestrationEvent(eventId, {
    status: "succeeded",
    payload: { ...event.payload, runner: { stub: true, note: "..." } },
  });
  return;
}
```

**Erstat med:**
```typescript
if (event.type === "lead_heartbeat") {
  await dispatchLeadHeartbeat(eventId, event, apiKey);
  return;
}
```

**Import øverst i filen:**
```typescript
import { dispatchLeadHeartbeat } from "./lead-heartbeat";
```

---

### T7.4 — Heartbeat scheduler i poll.ts

**Fil:** `runner/poll.ts`

Lead heartbeat skal køre automatisk — **ikke** kun når et menneske klikker "Run Heartbeat" i UI'en. Runner'en skal selv oprette `lead_heartbeat` events med jævne mellemrum.

Tilføj **under** `pollOnce()` en ny funktion:

```typescript
/** Minimum interval between heartbeats per business (milliseconds). */
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutter

/** Tracks last scheduled heartbeat per businessId. In-process only; resets on restart. */
const lastHeartbeatScheduled = new Map<string, number>();

/**
 * For each business that has a lead agent (runsHeartbeat=true),
 * ensures a pending lead_heartbeat event exists if the interval has elapsed.
 * Safe to call on every poll tick — idempotent via time check.
 */
export async function scheduleLeadHeartbeats(): Promise<void>
```

**Implementering:**

```typescript
const businessesWithLead = await getBusinessesWithLeadAgent();

for (const { businessId } of businessesWithLead) {
  const last = lastHeartbeatScheduled.get(businessId) ?? 0;
  const now = Date.now();
  if (now - last < HEARTBEAT_INTERVAL_MS) continue;

  lastHeartbeatScheduled.set(businessId, now);
  await logEvent({
    type: "lead_heartbeat",
    businessId,
    payload: { trigger: "scheduled", scheduledAt: new Date().toISOString() },
    status: "pending",
  });

  runnerLog("runner/poll", `Scheduled lead_heartbeat for business ${businessId}`);
}
```

**Ny query i `runner/queries.ts`:**

```typescript
/**
 * Returns all businessIds that have at least one agent with runsHeartbeat=true.
 */
export async function getBusinessesWithLeadAgent(): Promise<{ businessId: string }[]>
```

```typescript
// Implementering i queries.ts:
import { agents, systemRoles } from "@/db/schema";
// ...
export async function getBusinessesWithLeadAgent() {
  const db = getDb();
  const rows = await db
    .selectDistinct({ businessId: agents.businessId })
    .from(agents)
    .innerJoin(systemRoles, eq(agents.systemRoleId, systemRoles.id))
    .where(eq(systemRoles.runsHeartbeat, true));
  return rows;
}
```

**Kald `scheduleLeadHeartbeats()` fra runner-loop:**

**Fil:** `runner/index.ts`

Find det eksisterende poll-loop og tilføj kald til `scheduleLeadHeartbeats`:

```typescript
// FØR pollOnce — sørg for heartbeats er planlagt
await scheduleLeadHeartbeats();
await pollOnce();
```

Import: `import { scheduleLeadHeartbeats } from "./poll";`

---

### T7.5 — Tilpas lib/heartbeat/actions.ts

**Fil:** `lib/heartbeat/actions.ts`

Den eksisterende `runHeartbeat` Server Action bruges i UI'en. Når brugeren klikker "Run Heartbeat" manuelt, skal den tjekke om agenten er lead (runsHeartbeat=true) og i så fald oprette et `lead_heartbeat` event via runner frem for at køre direkte.

**Tilføj check øverst i `runHeartbeat`:**

```typescript
// Hent agent's system_role for at tjekke runsHeartbeat
const agentRow = await db.query.agents.findFirst({
  where: eq(agents.id, agentId),
  columns: { systemRoleId: true },
});

if (agentRow?.systemRoleId) {
  const role = await db.query.systemRoles.findFirst({
    where: eq(systemRoles.id, agentRow.systemRoleId),
    columns: { runsHeartbeat: true },
  });

  if (role?.runsHeartbeat === true) {
    // Lead agent — route til runner via orchestration event
    const [eventRow] = await db
      .insert(orchestrationEvents)
      .values({
        businessId,
        type: "lead_heartbeat",
        payload: { agentId, trigger: "manual_ui" },
        status: "pending",
      })
      .returning({ id: orchestrationEvents.id });
    return { success: true, eventId: eventRow?.id ?? "unknown" };
  }
}

// Ikke-lead agent — eksisterende flow fortsætter uændret
```

**Import:** tilføj `agents, systemRoles` til eksisterende import fra `@/db/schema`.

---

## Test-krav

**Test-filer du skal oprette:**

### `runner/__tests__/lead-heartbeat.test.ts`

```typescript
describe("dispatchLeadHeartbeat", () => {
  it("fails if no businessId")
  it("fails if readiness gate not met")
  it("fails if no lead agent with runsHeartbeat=true")
  it("promotes up to heartbeatPromotionCap tasks")
  it("does not promote BLOCKED tasks")
  it("logs all promotions and errors in event payload")
})

describe("parseLeadOutput", () => {
  it("extracts promote list from json block")
  it("handles raw JSON without code fence")
  it("returns empty array for unparseable output")
  it("filters non-string entries")
})
```

### `runner/__tests__/lead-heartbeat-scheduler.test.ts`

```typescript
describe("scheduleLeadHeartbeats", () => {
  it("creates lead_heartbeat event when interval has elapsed")
  it("does not create event if interval has not elapsed")
  it("handles multiple businesses independently")
})
```

Kør: `npm test` — alle tests grønne inden du push'er.

---

## Commit-disciplin

Commit **fra din worktree-mappe** (`../ai-business-s7-heartbeat`):

```
feat(runner): add lead-heartbeat dispatcher with Cursor SDK + cap enforcement (T7.1)
feat(runner): add lead-heartbeat prompt builder with task gate context (T7.2)
feat(runner): wire lead-heartbeat dispatcher into dispatch.ts replacing stub (T7.3)
feat(runner): add lead-heartbeat scheduler to poll loop with 5min interval (T7.4)
feat(heartbeat): route manual runHeartbeat to runner for lead agents (T7.5)
test(runner): lead heartbeat dispatcher, parser and scheduler tests
```

Push efter hvert commit:
```bash
git push origin feat/lead-heartbeat
```

---

## Hvad du IKKE må gøre

- **Aldrig** `git commit` eller `git push` fra `ai-business/` (kun fra `ai-business-s7-heartbeat/`).
- **Aldrig** `git checkout main` eller `git merge` i din worktree.
- **Aldrig** ændre `db/schema.ts` — S1 er done.
- **Aldrig** køre `npm run db:generate` eller `npm run db:migrate`.
- **Aldrig** ændre `lib/tasks/auto-trigger.ts`, `lib/tasks/gate-evaluator.ts` — S6 er done.
- **Aldrig** ændre `runner/poll.ts`'s mutex-logik — S5 er done (du **tilføjer** til poll.ts, du omskriver ikke).
- **Aldrig** merge PR til `main` — lad Manager gøre det.

---

## Afslutning — din rapport skal indeholde

1. PR-URL (den du oprettede i Trin 4).
2. Liste over commits med hash (`git log --oneline feat/lead-heartbeat ^origin/main`).
3. Output af `npm test` — skal være grøn.
4. Bekræftelse: `lead_heartbeat` stub i dispatch.ts er erstattet med rigtig implementering.
5. Bekræftelse: scheduler opretter events hvert 5. minut per business med lead-agent.
6. Bekræftelse: heartbeat cap overholdes — max N promotioner pr. tick.
7. Eventuelle afvigelser fra spec med begrundelse.
