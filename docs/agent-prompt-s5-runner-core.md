# Agent Prompt — S5: Runner Core

> **Til agenten:** Læs denne prompt i sin helhed før du rører én fil. Følg **Git-disciplin** præcist — ingen undtagelser.

---

## Dit opdrag

Du skal implementere **S5 — Runner Core** fra:

- **PRD:** `docs/prd-autonomous-agent-flow-v1.md` — F5 (kø/mutex), F7 (git-preflight), F10 (Cursor runtime)
- **Task-plan:** `docs/tasks-autonomous-agent-flow-v1.md` — afsnittet **S5**, T5.1–T5.8

S5 er **infrastruktur-sporet** — det er her runner'en får den faktiske disciplin der gør autonomi sikker. S7 (lead heartbeat) venter på dette spor. S6 kører parallelt med dig.

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
git worktree add ../ai-business-s5-runner feat/runner-core
cd ../ai-business-s5-runner
```

Alt arbejde foregår i `../ai-business-s5-runner`. Commit aldrig direkte til `main`.

### Trin 3 — Opret Draft PR med det samme (inden du koder)

```bash
cd ../ai-business-s5-runner
gh pr create \
  --title "feat: runner core — mutex, git-preflight, Cursor resolver, readiness gate (S5)" \
  --body "## S5 — Runner Core

Implementerer sikker agent-eksekvering: per-agent mutex, git-preflight, Cursor runtime resolver og readiness gate.

**PRD:** docs/prd-autonomous-agent-flow-v1.md (F5, F7, F10)
**Tasks:** docs/tasks-autonomous-agent-flow-v1.md#s5

### Ændringer
- [ ] T5.1 — Per-agent mutex i FIFO kø
- [ ] T5.2 — Optional business parallel-loft
- [ ] T5.3 — mention_trigger → webhook_trigger i dispatcher
- [ ] T5.4 — Git-preflight modul (fetch, clean check, checkout, worktree)
- [ ] T5.5 — Integrer git-preflight i dispatcher (kun for requiresGitWorkspace)
- [ ] T5.6 — Cursor runtime resolver (auto/inherit/konkret kæde)
- [ ] T5.7 — Readiness-gate check
- [ ] T5.8 — lead_heartbeat event-type stub i dispatcher

### Test
- [ ] npm test grøn
- [ ] Mutex: samme agent blokeres, forskellige kører parallelt
- [ ] Git-preflight: abort ved dirty tree
- [ ] Cursor resolver: alle kombinationer af auto/inherit/konkret

## Quality gate
🟡 Yellow — S5 er prereq for S7 (lead heartbeat)." \
  --draft \
  --base main
```

---

## Kontekst du skal læse FØR implementering

1. `runner/poll.ts` — eksisterende poll-loop (forstå `inFlight` Set og flow)
2. `runner/dispatch.ts` — eksisterende dispatcher (du udvider denne)
3. `runner/worktree.ts` — eksisterende worktree-logik (`prepareWorkingDirectory`)
4. `runner/queries.ts` — eksisterende DB-queries til runner
5. `runner/prompt-builder.ts` — prompt-builder (uændret)
6. `db/schema.ts` — find `orchestrationEvents`, `agents`, `businesses`, `systemRoles` (nye S1-felter)
7. `docs/prd-autonomous-agent-flow-v1.md` — F5, F7, F10

Læs **ikke** `node_modules`, `.next`, `drizzle/`, `runner/_archived/`.

---

## Implementeringsopgaver

### T5.1 — Per-agent mutex i poll-loop

**Fil:** `runner/poll.ts`

Udvid den eksisterende `inFlight` Set til at tracke **agent-ID'er** — ikke kun event-ID'er:

```typescript
const inFlight = new Set<string>();        // event ids (eksisterende)
const agentInFlight = new Set<string>();   // agent ids (ny)
```

I `pollOnce()` — inden `dispatchOrchestrationEvent` kaldes:

1. Hent agent-id for eventen (fra payload eller via `getLeadAgentIdForBusiness` / `pickAgentIdOverride` — samme logik som i `dispatch.ts`).
2. Hvis `agentInFlight.has(agentId)` → skip denne event (lad den forblive pending til næste poll-tick).
3. Hvis ikke: `agentInFlight.add(agentId)` inden dispatch, `agentInFlight.delete(agentId)` i `finally`.

```typescript
// Pseudokode for udvidet pollOnce:
export async function pollOnce(): Promise<void> {
  const pending = await listPendingOrchestrationEvents(8);
  for (const row of pending) {
    if (inFlight.has(row.id)) continue;

    // Hent agentId fra event payload for mutex check
    const agentId = await resolveAgentIdForEvent(row.id);
    if (agentId && agentInFlight.has(agentId)) continue; // agent busy

    const claimed = await tryClaimOrchestrationEvent(row.id);
    if (!claimed) continue;

    inFlight.add(row.id);
    if (agentId) agentInFlight.add(agentId);

    dispatchOrchestrationEvent(...).finally(() => {
      inFlight.delete(row.id);
      if (agentId) agentInFlight.delete(agentId);
    });
  }
}
```

**Ny helper i `runner/queries.ts`:**
```typescript
export async function resolveAgentIdForEvent(eventId: string): Promise<string | null>
// Henter event payload og returnerer agentId hvis den er sat i payload,
// ellers lead agent for businessId.
```

**Test:** `runner/__tests__/poll-mutex.test.ts` — mock `dispatchOrchestrationEvent`; verify at to events for samme agent ikke kører parallelt.

---

### T5.2 — Optional business parallel-loft

**Fil:** `runner/poll.ts`

Tilføj `businessInFlight` counter:

```typescript
const businessInFlight = new Map<string, number>(); // businessId → antal inflight
```

Inden dispatch: hent `business.maxParallelRuns`. Hvis `maxParallelRuns !== null` og `businessInFlight.get(businessId) >= maxParallelRuns` → skip.

Inkrement i start, dekrement i `finally`.

**Ny query i `runner/queries.ts`:**
```typescript
export async function getBusinessMaxParallelRuns(businessId: string): Promise<number | null>
// Returnerer businesses.maxParallelRuns (null = ubegrænset).
```

**Test:** loft=2, 3 events for samme business → kun 2 startes.

---

### T5.3 — mention_trigger → webhook_trigger i dispatcher

**Fil:** `runner/dispatch.ts`

Erstat den eksisterende fejl ved `mention_trigger`:

```typescript
// FØR (fejler):
if (event.type !== "webhook_trigger") {
  await finishOrchestrationEvent(eventId, { status: "failed", ... });
  return;
}

// EFTER — håndter begge typer:
if (event.type !== "webhook_trigger" && event.type !== "mention_trigger") {
  await finishOrchestrationEvent(eventId, { status: "failed", ... });
  return;
}
```

For `mention_trigger`-events: brug samme flow som `webhook_trigger` men tilføj mention-kontekst til prompt via `buildOrchestrationPrompt`. Udvid `buildOrchestrationPrompt` i `runner/prompt-builder.ts` med optional `mentionExcerpt?: string` parameter der prepender:

```
## Mention context
A user mentioned you in a task comment:
> {excerpt}
```

---

### T5.4 — Git-preflight modul

**Ny fil:** `runner/git-preflight.ts`

```typescript
import { execFileSync } from "node:child_process";
import { logEvent } from "@/lib/orchestration/events";

export interface GitPreflightOptions {
  localPath: string;
  integrationBranch: string;
  prBranch?: string;
  worktreeKey?: string;
  businessId: string;
  eventId: string;
}

export async function runGitPreflight(
  opts: GitPreflightOptions
): Promise<{ cwd: string; cleanup: () => void }>
```

**Trin (i rækkefølge — abort med logget fejl ved hvert trin):**

```typescript
// 1. Fetch
execFileSync("git", ["-C", opts.localPath, "fetch", "origin"], { encoding: "utf8" });
await logEvent({ type: "runner.git_preflight", businessId: opts.businessId,
  payload: { step: "fetch", eventId: opts.eventId }, status: "succeeded" });

// 2. Clean check
const dirty = execFileSync("git", ["-C", opts.localPath, "status", "--porcelain"], { encoding: "utf8" });
if (dirty.trim().length > 0) {
  throw new Error(`Dirty working tree — commit or stash changes before runner: ${dirty.trim().slice(0, 200)}`);
}

// 3. Checkout + pull integration branch
execFileSync("git", ["-C", opts.localPath, "checkout", opts.integrationBranch], { encoding: "utf8" });
execFileSync("git", ["-C", opts.localPath, "pull", "--ff-only", "origin", opts.integrationBranch], { encoding: "utf8" });
await logEvent({ type: "runner.git_preflight", businessId: opts.businessId,
  payload: { step: "checkout_integration", branch: opts.integrationBranch, eventId: opts.eventId },
  status: "succeeded" });

// 4. PR branch worktree (kun hvis prBranch + worktreeKey er sat)
if (opts.prBranch && opts.worktreeKey) {
  // Genrug eksisterende prepareWorkingDirectory logik fra runner/worktree.ts
  // men med opts.prBranch som branch
  const { cwd, cleanup } = preparePrWorktree(opts.localPath, opts.prBranch, opts.worktreeKey);
  await logEvent({ type: "runner.git_preflight", businessId: opts.businessId,
    payload: { step: "pr_worktree", branch: opts.prBranch, cwd, eventId: opts.eventId },
    status: "succeeded" });
  return { cwd, cleanup };
}

// Ingen PR branch — brug integrationBranch root
return { cwd: opts.localPath, cleanup: () => undefined };
```

**Hjælpefunktion** `preparePrWorktree` — intern i filen, ligner eksisterende `prepareWorkingDirectory` men tager en eksplicit branch.

**Test:** `runner/__tests__/git-preflight.test.ts` — mock `execFileSync`; verify:
- dirty tree kaster med beskrivende fejl
- fetch fejl kaster
- pull fejl kaster
- succesfuldt flow returnerer korrekt cwd
- logEvent kaldes for hvert trin

---

### T5.5 — Integrer git-preflight i dispatcher

**Fil:** `runner/dispatch.ts`

Erstat den eksisterende `prepareWorkingDirectory`-kald med `runGitPreflight` — **kun** hvis `agent.systemRole.requiresGitWorkspace === true`:

```typescript
// FØR:
const isEngineer = agent.systemRole.slug === "engineer";
const { cwd, cleanup } = prepareWorkingDirectory({
  localPathAbs: localPath,
  useWorktree: isEngineer,
  worktreeKey: taskId ?? eventId,
});

// EFTER:
let cwd: string;
let cleanup: () => void;

if (agent.systemRole.requiresGitWorkspace) {
  const integrationBranch = await getBusinessIntegrationBranch(businessId);
  if (!integrationBranch) {
    await finishOrchestrationEvent(eventId, {
      status: "failed",
      payload: { ...event.payload, runnerError: "integrationBranch not set in workspace settings." },
    });
    return;
  }
  // Hent PR branch fra task hvis taskId er sat
  const prBranch = taskId ? await getTaskPrBranch(taskId) : undefined;
  ({ cwd, cleanup } = await runGitPreflight({
    localPath,
    integrationBranch,
    prBranch,
    worktreeKey: taskId ?? eventId,
    businessId,
    eventId,
  }));
} else {
  // Non-git roller (analyst, ux_designer etc.) kører fra localPath direkte
  cwd = localPath;
  cleanup = () => undefined;
}
```

**Nye queries i `runner/queries.ts`:**
```typescript
export async function getBusinessIntegrationBranch(businessId: string): Promise<string | null>
// Returnerer businesses.integrationBranch

export async function getTaskPrBranch(taskId: string): Promise<string | undefined>
// Henter tasks.githubPrNumber og evt. PR-branch navn fra github_installations
// I v1: returner undefined — PR branch resolving er S7-scope
```

---

### T5.6 — Cursor runtime resolver

**Ny fil:** `runner/cursor-config-resolver.ts`

```typescript
import { getDb } from "@/db/index";
import { agents, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";

const PLATFORM_DEFAULT_MODEL = "composer-2";
const PLATFORM_DEFAULT_EFFORT = "auto";

export interface ResolvedCursorConfig {
  /** Undefined means: don't pass model to SDK (let Cursor choose). */
  modelId: string | undefined;
  /** Undefined means: don't pass thinkingEffort to SDK. */
  thinkingEffort: string | undefined;
}

/**
 * Resolves Cursor SDK config for an agent run.
 *
 * Semantics:
 *   'auto'    → send nothing to SDK (Cursor default)
 *   'inherit' → use business default → platform default
 *   <slug>    → use directly
 */
export async function resolveCursorConfig(
  agentId: string,
  businessId: string
): Promise<ResolvedCursorConfig>
```

**Implementering:**

```typescript
const db = getDb();

const [agent, business] = await Promise.all([
  db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    columns: { cursorModelId: true, cursorThinkingEffort: true },
  }),
  db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: { defaultCursorModelId: true, defaultCursorThinkingEffort: true },
  }),
]);

function resolve(
  agentVal: string | null | undefined,
  businessVal: string | null | undefined,
  platformDefault: string
): string | undefined {
  if (!agentVal || agentVal === "auto") return undefined; // SDK vælger
  if (agentVal === "inherit") {
    const biz = businessVal?.trim();
    if (biz && biz !== "auto" && biz !== "inherit") return biz;
    return platformDefault === "auto" ? undefined : platformDefault;
  }
  return agentVal; // konkret slug
}

return {
  modelId: resolve(agent?.cursorModelId, business?.defaultCursorModelId, PLATFORM_DEFAULT_MODEL),
  thinkingEffort: resolve(agent?.cursorThinkingEffort, business?.defaultCursorThinkingEffort, PLATFORM_DEFAULT_EFFORT),
};
```

**Integrer i `runner/dispatch.ts`** — erstat den hardcodede `const MODEL_ID = "composer-2"`:

```typescript
const cursorConfig = await resolveCursorConfig(agentId, businessId);

agentSdk = await Agent.create({
  apiKey: apiKey.trim(),
  ...(cursorConfig.modelId ? { model: { id: cursorConfig.modelId } } : {}),
  local: { cwd },
});
```

**Test:** `runner/__tests__/cursor-config-resolver.test.ts`

```typescript
describe("resolveCursorConfig", () => {
  it("returns undefined for model when agent is 'auto'")
  it("returns undefined for model when agent is 'inherit' and business is null")
  it("returns business model when agent is 'inherit' and business has value")
  it("returns agent model directly when it is a concrete slug")
  it("returns platform default when agent is 'inherit' and business is 'auto'")
})
```

---

### T5.7 — Readiness-gate check

**Ny fil:** `runner/readiness-check.ts`

```typescript
/**
 * Throws a descriptive error if the business is not ready for agent execution.
 * Call this before any SDK invocation in the dispatcher.
 */
export async function assertBusinessReadyForExecution(
  businessId: string,
  localPath: string | null
): Promise<void>
```

**Checks (i rækkefølge — kast ved første fejl med præcis besked):**

```typescript
// 1. Business memory
const hasMemory = await requireBusinessMemoryExists(businessId);
if (!hasMemory) throw new Error(
  "Business has no memory. Complete Grill-Me onboarding or add memory in workspace settings first."
);

// 2. Local path
if (!localPath?.trim()) throw new Error(
  "localPath is not set. Set the workspace folder path in Settings."
);

// 3. integrationBranch (kun krævet for git-workspace agenter — tjekkes i T5.5 kontekst)
// Her: bare warn i payload, ikke hard fail — branch-check sker i T5.5

// 4. Cursor API key (allerede håndteret i poll.ts — men dobbelttjek)
// Ikke nødvendigt her — poll.ts fejler allerede før dispatch
```

**Integrer i `runner/dispatch.ts`** — kald `assertBusinessReadyForExecution(businessId, localPath)` som **allerførste trin** efter at `businessId` og `localPath` er hentet.

**Test:**
```typescript
it("throws if no business memory exists")
it("throws if localPath is null or empty")
it("passes when memory and localPath are present")
```

---

### T5.8 — lead_heartbeat event-type stub

**Fil:** `runner/dispatch.ts`

Tilføj `lead_heartbeat` som håndteret type (stub der logges og returnerer success — S7 udfylder logikken):

```typescript
// I dispatchOrchestrationEvent — efter webhook_trigger/mention_trigger check:
if (event.type === "lead_heartbeat") {
  await finishOrchestrationEvent(eventId, {
    status: "succeeded",
    payload: {
      ...event.payload,
      runner: { stub: true, note: "lead_heartbeat not yet implemented — S7 will fill this" },
    },
  });
  return;
}
```

Dette sikrer at `lead_heartbeat`-events ikke fejler og blokerer køen mens S7 bygges.

---

## Commit-disciplin

```
feat(runner): add per-agent mutex to poll loop (T5.1)
feat(runner): add optional business parallel cap (T5.2)
feat(runner): handle mention_trigger as webhook_trigger in dispatcher (T5.3)
feat(runner): add git-preflight module with abort on dirty tree (T5.4)
feat(runner): integrate git-preflight for git-workspace agents (T5.5)
feat(runner): add cursor runtime config resolver with auto/inherit semantics (T5.6)
feat(runner): add business readiness gate check (T5.7)
feat(runner): add lead_heartbeat stub in dispatcher (T5.8)
test(runner): mutex, git-preflight, cursor resolver, readiness gate tests
```

Push efter hvert commit: `git push origin feat/runner-core`

---

## Hvad du IKKE må gøre

- Ændre `runner/orchestrator/` — den er et separat sidecar-system.
- Ændre `lib/tasks/` eller `app/dashboard/` — tilhører S4/S6.
- Ændre `db/schema.ts` — S1 er done.
- Køre `db:generate` eller `db:migrate`.
- Merge til `main` — PR er draft.

---

## Afslutning — din rapport skal indeholde

1. PR-URL.
2. Liste over commits med hash.
3. Output af `npm test` (grøn).
4. Bekræftelse: dispatcher håndterer `mention_trigger` og `lead_heartbeat` uden at fejle.
5. Bekræftelse: git-preflight afbryder ved dirty tree med logget fejl.
6. Eventuelle afvigelser med begrundelse.
