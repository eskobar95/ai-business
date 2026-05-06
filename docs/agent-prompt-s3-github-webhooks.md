# Agent Prompt — S3: GitHub Webhooks (PR-sandhed)

> **Til agenten:** Læs denne prompt i sin helhed før du rører én fil. Følg **Git-disciplin** præcist — ingen undtagelser.

---

## Dit opdrag

Du skal implementere **S3 — GitHub Webhooks** fra:

- **PRD:** `docs/prd-autonomous-agent-flow-v1.md` — F12 (GitHub PR-status), F2 (PR merge gate)
- **Task-plan:** `docs/tasks-autonomous-agent-flow-v1.md` — afsnittet **S3**, T3.1–T3.3

S3 kører **parallelt** med S2 og S4. Du leverer **PR-sandhed til DB og UI** — S5 og S7 venter på dit output for at gate-evaluering kan virke med rigtige data.

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
git worktree add ../ai-business-s3-github feat/github-pr-webhooks
cd ../ai-business-s3-github
```

Alt arbejde foregår i `../ai-business-s3-github`. Commit aldrig direkte til `main`.

### Trin 3 — Opret Draft PR med det samme (inden du koder)

```bash
cd ../ai-business-s3-github
gh pr create \
  --title "feat: GitHub App webhook handler — PR status and merge gate (S3)" \
  --body "## S3 — GitHub Webhooks (PR-sandhed)

Implementerer verificeret GitHub App webhook endpoint der holder PR-status synkroniseret i DB.

**PRD:** docs/prd-autonomous-agent-flow-v1.md (F12, F2)
**Tasks:** docs/tasks-autonomous-agent-flow-v1.md#s3

### Ændringer
- [ ] T3.1 — POST /api/github/webhook (HMAC verify, idempotency, dispatch)
- [ ] T3.2 — PR event handler (status sync + prMergedToIntegration gate)
- [ ] T3.3 — PR-status badge komponent til task UI
- [ ] TX2 — .env.example opdateret med GITHUB_WEBHOOK_SECRET

### Test
- [ ] npm test grøn
- [ ] Vitest: alle PR action-typer + HMAC afvisning + idempotency

## Quality gate
🟡 Yellow — S3 leverer PR-sandhed til S5 (gate-evaluering) og S7 (heartbeat)." \
  --draft \
  --base main
```

Notér PR-URL og inkludér den i din rapport.

---

## Kontekst du skal læse FØR implementering

1. `app/api/webhooks/[businessId]/receive/route.ts` — eksisterende webhook-endpoint (forstå HMAC-pattern og idempotency-mønster)
2. `app/api/github/install/route.ts` + `app/api/github/callback/route.ts` — eksisterende GitHub-integration (forstå installations-pattern)
3. `db/schema.ts` — find `githubInstallations`, `tasks`, `orchestrationEvents`, `webhookDeliveries` (forstå relationer og nye felter fra S1)
4. `lib/webhooks/hmac.ts` — eksisterende HMAC-hjælper (genbruges)
5. `lib/orchestration/events.ts` — `logEvent` funktion (genbruges til audit)
6. `.env.example` — forstå eksisterende secrets-pattern
7. `docs/prd-autonomous-agent-flow-v1.md` — F12 (komplet PR-flow beskrivelse)

Læs **ikke** `node_modules`, `.next`, `drizzle/`.

---

## Implementeringsopgaver

### T3.1 — GitHub App webhook endpoint

**Ny fil:** `app/api/github/webhook/route.ts`

Dette er et **separat** endpoint fra den eksisterende `/api/github/install` og `/api/github/callback`. Det modtager **live events fra GitHub App**.

```typescript
// app/api/github/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse>
```

**Flow (i rækkefølge):**

1. **Hent headers:**
   ```
   x-hub-signature-256   (GitHub HMAC)
   x-github-event        (event type: "pull_request", "ping", etc.)
   x-github-delivery     (unik delivery ID — bruges som idempotency key)
   ```

2. **Valider tilstedeværelse:** Return 400 hvis `x-hub-signature-256` eller `x-github-delivery` mangler.

3. **Læs raw body som tekst** (kræves for korrekt HMAC-verifikation).

4. **Verificer HMAC:**
   ```typescript
   import { verifySignature } from "@/lib/webhooks/hmac";
   const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
   if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
   if (!verifySignature(rawBody, sigHeader, secret)) {
     return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
   }
   ```

5. **Idempotency:** Check `webhookDeliveries` for `idempotencyKey = x-github-delivery`. Hvis allerede leveret: return 202.

6. **Parse JSON body.**

7. **Event routing:**
   - `x-github-event === "ping"`: Indsæt delivery som leveret, return 200 `{ ok: true }`.
   - `x-github-event === "pull_request"`: Dispatch til `handlePullRequestEvent(payload)`.
   - Alt andet: Indsæt delivery som leveret (ignorer), return 202.

8. **Indsæt `webhookDeliveries`-række** med `type = x-github-event`, `status = 'delivered'` efter succesfuld håndtering.

**Fejlhåndtering:** Enhver uventet fejl returnerer 500 — GitHub vil retry.

---

### T3.2 — PR event handler

**Ny fil:** `lib/github/pr-webhook-handler.ts`

#### Type-definition

```typescript
// Minimal type for det vi bruger fra GitHub's pull_request payload
export interface GitHubPRPayload {
  action: string; // "opened"|"closed"|"reopened"|"converted_to_draft"|"ready_for_review"|...
  number: number; // PR nummer
  pull_request: {
    merged: boolean;
    base: { ref: string }; // base branch navn
    head: { ref: string }; // feature branch navn
  };
  repository: {
    full_name: string; // "owner/repo"
  };
  installation?: { id: number };
}
```

#### Hoved-funktion

```typescript
export async function handlePullRequestEvent(payload: GitHubPRPayload): Promise<void>
```

**Logik trin for trin:**

**1. Find installation:**
```typescript
// Match repository.full_name mod github_installations
// Kig på repoFullName eller repoUrl kolonnen
const installation = await db.query.githubInstallations.findFirst({
  where: ... // match på repository full_name
});
if (!installation) return; // ukendt repo — ignorer stille
```

**2. Find business via installation:**
```typescript
// github_installations har businessId
const businessId = installation.businessId;
```

**3. Hent business.integrationBranch:**
```typescript
const business = await db.query.businesses.findFirst({
  where: eq(businesses.id, businessId),
  columns: { integrationBranch: true }
});
const integrationBranch = business?.integrationBranch;
```

**4. Map action til PR-status:**
```typescript
function mapActionToStatus(action: string, merged: boolean): string | null {
  if (action === "opened" || action === "reopened" || action === "ready_for_review") return "open";
  if (action === "converted_to_draft") return "draft";
  if (action === "closed" && merged) return "merged";
  if (action === "closed" && !merged) return "closed";
  return null; // andre actions ignoreres
}
```

**5. Opdater tasks:**
```typescript
// Find alle tasks med matching githubPrNumber + githubRepoInstallationId
const matchingTasks = await db.query.tasks.findMany({
  where: and(
    eq(tasks.githubPrNumber, payload.number),
    eq(tasks.githubRepoInstallationId, installation.id)
  )
});

for (const task of matchingTasks) {
  const updates: Partial<...> = {
    githubPrStatus: newStatus,
    updatedAt: new Date()
  };

  // Sæt merge-gate KUN ved merged til integrationBranch
  const isMergedToIntegration =
    payload.action === "closed" &&
    payload.pull_request.merged === true &&
    integrationBranch !== null &&
    payload.pull_request.base.ref === integrationBranch;

  if (isMergedToIntegration) {
    updates.prMergedToIntegration = true;
    updates.gatesLockedAt = new Date();
  }

  await db.update(tasks).set(updates).where(eq(tasks.id, task.id));
}
```

**6. Log audit-event ved merged:**
```typescript
if (isMergedToIntegration) {
  await logEvent({
    type: "github.pr.merged",
    businessId,
    payload: {
      prNumber: payload.number,
      repoFullName: payload.repository.full_name,
      baseBranch: payload.pull_request.base.ref,
      headBranch: payload.pull_request.head.ref,
      affectedTaskIds: matchingTasks.map(t => t.id),
    },
    status: "succeeded",
    correlationKey: `github-pr-${installation.id}-${payload.number}`,
  });
}
```

---

### T3.3 — PR-status badge komponent

**Ny fil:** `components/tasks/task-pr-badge.tsx`

```typescript
"use client";

type PRStatus = "draft" | "open" | "approved" | "merged" | "closed" | null;

export function TaskPrBadge({ status }: { status: PRStatus })
```

Styling (tilpas til eksisterende design-tokens i projektet):

| Status | Farve | Label |
|--------|-------|-------|
| `draft` | Grå | Draft |
| `open` | Gul/amber | Open |
| `approved` | Blå | Approved |
| `merged` | Grøn | Merged |
| `closed` | Rød | Closed |
| `null` | Ingenting | (render ikke) |

Brug `className` og Tailwind classes konsistent med øvrige badges i projektet (se `components/tasks/` for reference på farve-klasser).

---

### TX2 (delvis) — Opdater `.env.example`

Tilføj til `.env.example`:
```
GITHUB_WEBHOOK_SECRET=   # GitHub App webhook secret — kræves for PR-status sync (S3)
```

---

## Test-krav

**Fil:** `lib/github/__tests__/pr-webhook-handler.test.ts` (ny)

Test-cases der skal dækkes:

```typescript
describe("handlePullRequestEvent", () => {
  it("updates githubPrStatus to 'open' on action=opened")
  it("updates githubPrStatus to 'draft' on action=converted_to_draft")
  it("updates githubPrStatus to 'merged' and sets prMergedToIntegration=true when merged to integrationBranch")
  it("does NOT set prMergedToIntegration when merged to a different branch")
  it("updates githubPrStatus to 'closed' when closed without merge")
  it("ignores unknown repository (no installation match)")
  it("handles task with no matching githubPrNumber gracefully")
  it("logs github.pr.merged event when merged to integrationBranch")
  it("does NOT log event when merged to non-integration branch")
})

describe("POST /api/github/webhook", () => {
  it("returns 401 on invalid HMAC signature")
  it("returns 400 when x-hub-signature-256 header is missing")
  it("returns 400 when x-github-delivery header is missing")
  it("returns 202 for duplicate delivery (idempotency)")
  it("returns 200 for ping event")
  it("returns 202 for unhandled event types")
})
```

Brug `vi.mock` til at mocke DB og `logEvent`.

Kør: `npm test lib/github/__tests__/pr-webhook-handler.test.ts`  
Kør herefter: `npm test` — alle eksisterende tests skal forblive grønne.

---

## Commit-disciplin

```
feat(github): add verified webhook endpoint for GitHub App events (T3.1)
feat(github): add PR event handler with status sync and merge gate (T3.2)
feat(tasks): add PR status badge component (T3.3)
chore(env): add GITHUB_WEBHOOK_SECRET to .env.example (TX2)
test(github): webhook handler and endpoint tests
```

Push efter hvert commit: `git push origin feat/github-pr-webhooks`

---

## Hvad du IKKE må gøre

- Ændre eksisterende `/api/github/install` eller `/api/github/callback` — de fungerer.
- Ændre `db/schema.ts` — S1 er done.
- Køre `db:generate` eller `db:migrate`.
- Røre `lib/tasks/actions.ts` eller settings-komponenter — de tilhører S2/S4.
- Merge til `main` — PR er draft.

---

## Afslutning — din rapport skal indeholde

1. PR-URL.
2. Liste over commits med hash.
3. Output af `npm test` (grøn).
4. Beskrivelse af test-coverage for alle PR-actions.
5. Eventuelle afvigelser fra task-plan med begrundelse.
6. Bekræftelse: `GITHUB_WEBHOOK_SECRET` er tilføjet `.env.example`.
