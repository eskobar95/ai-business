# Agent Prompt — TX1: Agent Settings (fjern UI stubs)

> **Til agenten:** Læs denne prompt i sin helhed før du rører én fil. Følg **Git-disciplin** præcist — ingen undtagelser.

---

## Dit opdrag

Du skal implementere **TX1 — Agent settings: fjern UI stubs** fra:

- **PRD:** `docs/prd-autonomous-agent-flow-v1.md` — F10 (Cursor runtime felter)
- **Task-plan:** `docs/tasks-autonomous-agent-flow-v1.md` — afsnittet **TX1**

TX1 er et **afgrænset kosmetisk + data-fix**: agent-settings-formularen har hardcodede stub-værdier for Cursor-felter og heartbeat-cap. De skal erstattes med rigtige DB-værdier, og `updateAgent` Server Action skal gemme dem. S5 bruger disse felter i sin resolver — de skal ligge korrekt i DB.

TX1 er **lille og selvstændig** — den kan køre parallelt med S5 og S6.

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
git worktree add ../ai-business-tx1-agent-settings feat/agent-settings-cursor-fields
cd ../ai-business-tx1-agent-settings
```

Alt arbejde foregår i `../ai-business-tx1-agent-settings`. Commit aldrig direkte til `main`.

### Trin 3 — Opret Draft PR med det samme (inden du koder)

```bash
cd ../ai-business-tx1-agent-settings
gh pr create \
  --title "feat: wire Cursor runtime fields and Agent/System Role labels in agent settings (TX1)" \
  --body "## TX1 — Agent Settings: fjern UI stubs

Erstatter hardcodede UI-stubs med rigtige DB-felter for Cursor model, thinking effort og heartbeat cap.

**PRD:** docs/prd-autonomous-agent-flow-v1.md (F10)
**Tasks:** docs/tasks-autonomous-agent-flow-v1.md#tx1

### Ændringer
- [ ] Wire cursorModelId, cursorThinkingEffort, heartbeatPromotionCap fra agent til UI state
- [ ] Udvid updateAgent Server Action til at gemme Cursor-felter
- [ ] Dropdowns med auto/inherit/konkrete model-slugs
- [ ] heartbeatPromotionCap input kun synlig for runsHeartbeat=true roller
- [ ] Tooltips: Agent Role vs System Role

### Test
- [ ] npm test grøn
- [ ] Manuel smoke: gem Cursor-felter, verify de persisteres i DB

## Quality gate
🟢 Green — selvstændig rettelse, ingen breaking changes." \
  --draft \
  --base main
```

---

## Kontekst du skal læse FØR implementering

1. `components/agents/agent-settings-form.tsx` — **hele filen** (det er den du primært ændrer)
2. `components/agents/agent-settings-form-adapter-run-policy-part.tsx` — adapter/model/heartbeat UI
3. `lib/agents/actions.ts` — `updateAgent` Server Action (du udvider denne)
4. `db/schema.ts` — find `agents` tabel med `cursorModelId`, `cursorThinkingEffort`, `cursorRuntimeProfile`, `heartbeatPromotionCap`
5. `lib/settings/cursor-workspace-defaults.ts` — eksisterende model-konstanter fra S2 (genbruge disse hvis muligt)

Læs **ikke** `node_modules`, `.next`, `drizzle/`.

---

## Implementeringsopgaver

### TX1.1 — Konstanter for Cursor model og effort

**Fil:** `lib/agents/cursor-agent-config.ts` (ny, delt konstant-fil)

```typescript
export const CURSOR_MODEL_OPTIONS = [
  { value: "auto",            label: "Auto (Cursor vælger)" },
  { value: "inherit",         label: "Inherit fra workspace" },
  { value: "composer-2",      label: "Composer 2 (platform default)" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { value: "claude-opus-4",   label: "Claude Opus 4" },
  { value: "gpt-4.1",         label: "GPT-4.1" },
  { value: "gemini-2.5-pro",  label: "Gemini 2.5 Pro" },
] as const;

export const CURSOR_EFFORT_OPTIONS = [
  { value: "auto",   label: "Auto" },
  { value: "inherit", label: "Inherit fra workspace" },
  { value: "low",    label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High" },
] as const;

export type CursorModelValue = (typeof CURSOR_MODEL_OPTIONS)[number]["value"];
export type CursorEffortValue = (typeof CURSOR_EFFORT_OPTIONS)[number]["value"];

export function isValidCursorModel(v: string): v is CursorModelValue {
  return CURSOR_MODEL_OPTIONS.some(o => o.value === v);
}

export function isValidCursorEffort(v: string): v is CursorEffortValue {
  return CURSOR_EFFORT_OPTIONS.some(o => o.value === v);
}
```

---

### TX1.2 — Udvid `updateAgent` Server Action

**Fil:** `lib/agents/actions.ts`

Find den eksisterende `updateAgent` funktion. Tilføj nye accepterede felter:

```typescript
export async function updateAgent(
  agentId: string,
  patch: {
    name?: string;
    role?: string;
    reportsToAgentId?: string | null;
    systemRoleId?: string | null;
    // Nye felter:
    cursorModelId?: string;
    cursorThinkingEffort?: string;
    cursorRuntimeProfile?: string;
    heartbeatPromotionCap?: number;
  },
): Promise<void>
```

**Validering i Server Action (tilføj inden DB-skriv):**

```typescript
if (patch.cursorModelId !== undefined && !isValidCursorModel(patch.cursorModelId)) {
  throw new Error(`Invalid cursorModelId: ${patch.cursorModelId}`);
}
if (patch.cursorThinkingEffort !== undefined && !isValidCursorEffort(patch.cursorThinkingEffort)) {
  throw new Error(`Invalid cursorThinkingEffort: ${patch.cursorThinkingEffort}`);
}
if (patch.heartbeatPromotionCap !== undefined) {
  if (!Number.isInteger(patch.heartbeatPromotionCap) || patch.heartbeatPromotionCap < 1) {
    throw new Error("heartbeatPromotionCap must be a positive integer");
  }
}
```

Opdater `updates`-objektet til at inkludere de nye felter når de er sat.

---

### TX1.3 — Wire UI state fra agent DB-værdier

**Fil:** `components/agents/agent-settings-form.tsx`

**Find de tre stub-linjer:**
```typescript
// Adapter (UI-only stubs)
const [adapter, setAdapter] = useState<AgentAdapterId>("cursor_cli");
const [model, setModel] = useState("auto");
const [thinkingEffort, setThinkingEffort] = useState("auto");

// Run policy (UI-only stubs)
const [heartbeatEnabled, setHeartbeatEnabled] = useState(false);
const [heartbeatInterval, setHeartbeatInterval] = useState("30");
```

**Erstat med rigtige initial-værdier fra `agent`:**

```typescript
// Cursor runtime (wired to DB)
const [cursorModelId, setCursorModelId] = useState(agent.cursorModelId ?? "auto");
const [cursorThinkingEffort, setCursorThinkingEffort] = useState(agent.cursorThinkingEffort ?? "auto");
const [heartbeatPromotionCap, setHeartbeatPromotionCap] = useState(
  String(agent.heartbeatPromotionCap ?? 3)
);

// Beholder adapter som UI-only for nu (Hermes/Multi er post-MVP)
const [adapter, setAdapter] = useState<AgentAdapterId>("cursor_cli");
```

**Tilføj reset i useEffect der allerede syncer andre felter:**
```typescript
useEffect(() => {
  setSystemRoleId(agent.systemRoleId ?? "");
  setCursorModelId(agent.cursorModelId ?? "auto");
  setCursorThinkingEffort(agent.cursorThinkingEffort ?? "auto");
  setHeartbeatPromotionCap(String(agent.heartbeatPromotionCap ?? 3));
}, [agent.id, agent.systemRoleId, agent.cursorModelId, agent.cursorThinkingEffort, agent.heartbeatPromotionCap]);
```

---

### TX1.4 — Gem Cursor-felter i handleSave

**Fil:** `components/agents/agent-settings-form.tsx`

Find `handleSave` og tilføj de nye felter til `updateAgent`-kaldet:

```typescript
await updateAgent(agent.id, {
  name,
  role,
  reportsToAgentId: reportsToAgentId || null,
  systemRoleId: systemRoleId || null,
  // Nye felter:
  cursorModelId,
  cursorThinkingEffort,
  heartbeatPromotionCap: parseInt(heartbeatPromotionCap, 10) || 3,
});
```

---

### TX1.5 — Opdater Adapter/Run Policy UI-komponent

**Fil:** `components/agents/agent-settings-form-adapter-run-policy-part.tsx`

Opdater `Props` og komponenten til at bruge de rigtige state-felter:

```typescript
type Props = {
  adapter: AgentAdapterId;
  setAdapter: (id: AgentAdapterId) => void;
  cursorModelId: string;
  setCursorModelId: (v: string) => void;
  cursorThinkingEffort: string;
  setCursorThinkingEffort: (v: string) => void;
  heartbeatPromotionCap: string;
  setHeartbeatPromotionCap: (v: string) => void;
  /** Vis heartbeat promotion cap kun hvis agentens system_role har runsHeartbeat=true */
  showHeartbeatCap: boolean;
};
```

Model-dropdown: erstat hardcoded MODELS-array med import fra `lib/agents/cursor-agent-config.ts`:
```typescript
import { CURSOR_MODEL_OPTIONS, CURSOR_EFFORT_OPTIONS } from "@/lib/agents/cursor-agent-config";
```

Heartbeat-promotion-cap felt:
```typescript
{props.showHeartbeatCap && (
  <div className="mb-4">
    <p className="section-label mb-2">
      Promotion cap per heartbeat
      <FieldHint text="Max antal tasks denne agent må flytte fra backlog til todo pr. heartbeat-tick. Default: 3." />
    </p>
    <input
      type="number"
      min="1"
      max="50"
      value={props.heartbeatPromotionCap}
      onChange={e => props.setHeartbeatPromotionCap(e.target.value)}
      className="h-8 w-24 rounded-md border border-border bg-transparent px-3 text-[13px] text-foreground outline-none transition-colors focus:border-white/[0.18]"
    />
  </div>
)}
```

Fjern det nuværende `heartbeatEnabled`/`heartbeatInterval` toggle der er UI-only stub — erstat med `heartbeatPromotionCap`.

---

### TX1.6 — Pass `showHeartbeatCap` fra parent

**Fil:** `components/agents/agent-settings-form.tsx`

`showHeartbeatCap` bestemmes ud fra den valgte system role:

```typescript
const selectedSystemRole = platformSystemRoles.find(r => r.id === systemRoleId);
const showHeartbeatCap = selectedSystemRole?.runsHeartbeat === true;
```

Pass til `AgentSettingsAdapterRunPolicySections`:
```typescript
<AgentSettingsAdapterRunPolicySections
  adapter={adapter}
  setAdapter={setAdapter}
  cursorModelId={cursorModelId}
  setCursorModelId={setCursorModelId}
  cursorThinkingEffort={cursorThinkingEffort}
  setCursorThinkingEffort={setCursorThinkingEffort}
  heartbeatPromotionCap={heartbeatPromotionCap}
  setHeartbeatPromotionCap={setHeartbeatPromotionCap}
  showHeartbeatCap={showHeartbeatCap}
/>
```

`platformSystemRoles` skal nu inkludere `runsHeartbeat` — tjek at `AgentSettingsForm` parent-komponent sender det med. Tilføj til `PlatformSystemRole` type-selection hvis nødvendigt.

---

### TX1.7 — Tooltips: Agent Role vs System Role

**Fil:** `components/agents/agent-settings-form.tsx`

Find felterne for Agent Role og System Role i form-render. Tilføj `FieldHint` komponent (fra `components/settings/field-hint.tsx`, importér):

```typescript
import { FieldHint } from "@/components/settings/field-hint";
```

**Agent Role:**
```tsx
<label className="section-label flex items-center gap-1">
  Agent Role
  <FieldHint text="Fri tekst — vises som agentens jobtitel. Påvirker ikke runner-adfærd." />
</label>
```

**System Role:**
```tsx
<label className="section-label flex items-center gap-1">
  System Role
  <FieldHint text="Styrer runner-regler: git-preflight, PR-gates, promotion-rettigheder og heartbeat. Vælg omhyggeligt." />
</label>
```

---

## Test-krav

**Fil:** `lib/agents/__tests__/update-agent-cursor-fields.test.ts` (ny)

```typescript
describe("updateAgent — Cursor fields", () => {
  it("accepts valid cursorModelId values")
  it("rejects invalid cursorModelId")
  it("accepts valid cursorThinkingEffort values")
  it("rejects invalid cursorThinkingEffort")
  it("accepts heartbeatPromotionCap >= 1")
  it("rejects heartbeatPromotionCap = 0")
  it("rejects non-integer heartbeatPromotionCap")
})
```

Kør: `npm test lib/agents/__tests__/update-agent-cursor-fields.test.ts`
Kør herefter: `npm test` — alle eksisterende tests grønne.

---

## Commit-disciplin

```
feat(agents): add shared Cursor model and effort constants (TX1.1)
feat(agents): extend updateAgent to persist Cursor runtime fields (TX1.2)
feat(agents): wire Cursor fields from DB into agent settings form state (TX1.3)
feat(agents): save Cursor fields in handleSave (TX1.4)
feat(agents): replace heartbeat stub with promotion cap field (TX1.5)
feat(agents): show heartbeat cap only for runsHeartbeat system roles (TX1.6)
feat(agents): add tooltips for Agent Role vs System Role (TX1.7)
test(agents): updateAgent Cursor field validation tests
```

Push efter hvert commit: `git push origin feat/agent-settings-cursor-fields`

---

## Hvad du IKKE må gøre

- Ændre `runner/` — tilhører S5.
- Ændre `db/schema.ts` — S1 er done.
- Køre `db:generate` eller `db:migrate`.
- Fjerne `AgentSettingsPermissionsSection` — den forbliver som UI-stub (permissions er post-MVP).
- Merge til `main` — PR er draft.

---

## Afslutning — din rapport skal indeholde

1. PR-URL.
2. Liste over commits med hash.
3. Output af `npm test` (grøn).
4. Bekræftelse: agent-settings gemmer og viser `cursorModelId`, `cursorThinkingEffort`, `heartbeatPromotionCap` korrekt.
5. Bekræftelse: heartbeat cap vises kun for `runsHeartbeat=true` roller.
6. Eventuelle afvigelser med begrundelse.
