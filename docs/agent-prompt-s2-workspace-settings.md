# Agent Prompt — S2: Workspace Settings UI & API

> **Til agenten:** Læs denne prompt i sin helhed før du rører én fil. Følg **Git-disciplin** præcist — ingen undtagelser.

---

## Dit opdrag

Du skal implementere **S2 — Workspace Settings UI & API** fra:

- **PRD:** `docs/prd-autonomous-agent-flow-v1.md` — F10 (Cursor runtime), F11 (Business memory), F6 (parallel-loft)
- **Task-plan:** `docs/tasks-autonomous-agent-flow-v1.md` — afsnittet **S2**, T2.1–T2.4

S2 kører **parallelt** med S3 og S4. Du skal **ikke** vente på dem — men du må heller **ikke** røre filer der tilhører S3 (`app/api/github/webhook/`) eller S4 (`lib/tasks/actions.ts`, `lib/tasks/promotion-auth.ts`).

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
git worktree add ../ai-business-s2-settings feat/workspace-settings
cd ../ai-business-s2-settings
```

Alt arbejde foregår i `../ai-business-s2-settings`. Commit aldrig direkte til `main`.

### Trin 3 — Opret Draft PR med det samme (inden du koder)

```bash
cd ../ai-business-s2-settings
gh pr create \
  --title "feat: workspace settings — branches, memory editor, parallel cap, cursor defaults (S2)" \
  --body "## S2 — Workspace Settings UI & API

Implementerer settings-sektioner der er forudsætning for autonom agent-eksekvering.

**PRD:** docs/prd-autonomous-agent-flow-v1.md (F10, F11, F6)
**Tasks:** docs/tasks-autonomous-agent-flow-v1.md#s2

### Ændringer
- [ ] T2.1 — Branch-settings sektion (integrationBranch + releaseBranch)
- [ ] T2.2 — Parallel-loft toggle + tal-input
- [ ] T2.3 — Business memory editor (TiptapEditor, auto-save, ny sektion)
- [ ] T2.4 — Cursor defaults (model + thinking effort pr. business)

### Test
- [ ] npm test grøn
- [ ] Manuel smoke: settings gemmes og persisteres korrekt

## Quality gate
🟡 Yellow — S2 leverer til S5 (integrationBranch) og S7 (promotion cap)" \
  --draft \
  --base main
```

Notér PR-URL og inkludér den i din rapport.

---

## Kontekst du skal læse FØR implementering

1. `app/dashboard/settings/page.tsx` — eksisterende settings-side (forstå layout og sektions-pattern)
2. `app/dashboard/settings/settings-business-section.tsx` — eksisterende business-sektion (følg samme pattern)
3. `app/dashboard/settings/settings-business-profile-section.tsx` — yderligere pattern-reference
4. `db/schema.ts` — find `businesses`-tabellen og `memory`-tabellen (forstå nye kolonner fra S1)
5. `lib/grill-me/access.ts` — forstå `assertUserBusinessAccess` (bruges i Server Actions)
6. `components/ui/tiptap-editor.tsx` — eksisterende rich text editor (genbruges i T2.3)
7. `docs/prd-autonomous-agent-flow-v1.md` — F10, F11, F6

Læs **ikke** `node_modules`, `.next`, `drizzle/`.

---

## Implementeringsopgaver

### T2.1 — Branch-settings sektion

**Nye filer:**
- `components/settings/branch-settings-form.tsx` — klient-komponent
- `lib/settings/branch-actions.ts` — Server Actions (`"use server"`)

**Tilpas:** `app/dashboard/settings/page.tsx` — importer og render den nye sektion.

#### `lib/settings/branch-actions.ts`

```typescript
"use server";

export async function updateBusinessBranchSettings(
  businessId: string,
  input: { integrationBranch: string | null; releaseBranch: string | null }
): Promise<void>
```

Validering (kast Error med beskrivende besked):
- `integrationBranch` må kun indeholde bogstaver, tal, `-`, `_`, `.`, `/` — ingen mellemrum.
- Samme for `releaseBranch`.
- Kræv `assertUserBusinessAccess` inden DB-skriv.

DB-opdatering: `db.update(businesses).set({ integrationBranch, releaseBranch }).where(eq(businesses.id, businessId))`

#### `components/settings/branch-settings-form.tsx`

UI-felter:
- **Integration branch** — text input, placeholder `"staging"`, required.  
  Tooltip (?): *"Den branch agenter syncer fra og PR'er skal merges til for at gates åbnes."*
- **Release branch** — text input, placeholder `"main"`, optional.  
  Tooltip (?): *"Kun du godkender merge hertil. Ingen automation rører release."*
- Save-knap med pending-state.
- Toast ved success/fejl (brug `sonner`).

Props: `businessId: string`, `initialIntegrationBranch: string | null`, `initialReleaseBranch: string | null`.

---

### T2.2 — Parallel-loft sektion

**Nye filer:**
- `components/settings/parallel-settings-form.tsx`
- Tilføj `updateBusinessParallelSettings` til `lib/settings/branch-actions.ts`

#### Server Action

```typescript
"use server";

export async function updateBusinessParallelSettings(
  businessId: string,
  input: { maxParallelRuns: number | null }
): Promise<void>
```

Validering: `maxParallelRuns` skal enten være `null` eller et positivt heltal ≥ 1.

#### Komponent

```
Toggle: "Aktiver parallel-loft"  [OFF]
  └─ Når ON: tal-input "Max parallelle agent-runs" (min=1, type=number)
```

Tooltip på toggle (?): *"Gælder for hele dit workspace. Slået fra = ubegrænset (kun per-agent mutex aktiv)."*

Props: `businessId: string`, `initialMaxParallelRuns: number | null`.

---

### T2.3 — Business memory editor

**Nye filer:**
- `components/settings/memory-editor.tsx`
- `lib/settings/memory-actions.ts` — Server Actions

#### Server Actions

```typescript
"use server";

// Opdater indhold på eksisterende memory-række
export async function updateMemoryContent(
  memoryId: string,
  content: string
): Promise<void>

// Opret ny business-scope memory-række
export async function createBusinessMemorySection(
  businessId: string,
  initialContent?: string
): Promise<{ id: string }>
```

Begge kræver `assertUserBusinessAccess`.  
`memory`-tabel: `scope = 'business'`, `content = markdown/HTML`.

#### Komponent `memory-editor.tsx`

- Hent alle `memory`-rækker med `scope = 'business'` via Server Component (parent).
- Én `TiptapEditor` pr. række (genbrugt fra `components/ui/tiptap-editor.tsx`).
- Auto-save: 3 sekunders debounce → kald `updateMemoryContent`.
- "+ Ny sektion"-knap → kald `createBusinessMemorySection` → tilføj ny editor.
- Vis `updatedAt` tidsstempel pr. sektion.
- Tooltip øverst: *"Business memory injiceres automatisk i agent-prompts hvor 'Include business context' er aktiveret på system role."*

Props: `businessId: string`, `initialSections: Array<{ id: string; content: string; updatedAt: Date }>`.

---

### T2.4 — Cursor defaults sektion (business-niveau)

**Nye filer:**
- `components/settings/cursor-defaults-form.tsx`
- Tilføj `updateBusinessCursorDefaults` til `lib/settings/branch-actions.ts`

#### Server Action

```typescript
"use server";

export async function updateBusinessCursorDefaults(
  businessId: string,
  input: { defaultCursorModelId: string | null; defaultCursorThinkingEffort: string | null }
): Promise<void>
```

#### Komponent

To dropdowns:

**Model** — options:
```
{ value: null,           label: "Platform default (composer-2)" }
{ value: "auto",         label: "Auto (Cursor vælger)" }
{ value: "claude-sonnet-4", label: "Claude Sonnet 4" }
{ value: "claude-opus-4",   label: "Claude Opus 4" }
{ value: "gpt-4.1",         label: "GPT-4.1" }
{ value: "gemini-2.5-pro",  label: "Gemini 2.5 Pro" }
```

**Thinking effort** — options:
```
{ value: null,     label: "Platform default" }
{ value: "auto",   label: "Auto" }
{ value: "low",    label: "Low" }
{ value: "medium", label: "Medium" }
{ value: "high",   label: "High" }
```

Tooltip pr. felt (?):
- Model: *"`auto` = Cursor vælger. Agenter med 'inherit' arver dette valg."*
- Thinking effort: *"Påvirker svardybde og token-forbrug."*

---

### T2.5 — Integrer sektioner i settings-siden

**Fil:** `app/dashboard/settings/page.tsx`

Tilføj de fire nye sektioner til siden — følg eksisterende sektions-pattern (Server Component der henter data og sender som props til klient-komponenter).

Rækkefølge i siden:
1. Eksisterende sektioner (bevar dem uændrede).
2. **Workspace Execution** — branch-settings (T2.1) + parallel-loft (T2.2) + Cursor defaults (T2.4).
3. **Business Memory** — memory editor (T2.3).

Hent `business`-data (inkl. nye felter) og `memory`-rækker i Server Component og send som props.

---

## Test-krav

**Fil:** `lib/settings/__tests__/branch-actions.test.ts` (ny)

```typescript
describe("updateBusinessBranchSettings", () => {
  it("rejects branch names with spaces")
  it("rejects branch names with invalid characters")
  it("accepts valid branch names like 'staging' and 'feature/foo'")
  it("accepts null values (clearing the field)")
})

describe("updateBusinessParallelSettings", () => {
  it("accepts null (unlimited)")
  it("accepts positive integers")
  it("rejects 0 and negative numbers")
})
```

Kør: `npm test lib/settings/__tests__/branch-actions.test.ts`  
Kør herefter: `npm test` — alle eksisterende tests skal forblive grønne.

---

## Commit-disciplin

```
feat(settings): add branch settings form and server action (T2.1)
feat(settings): add parallel cap toggle and server action (T2.2)
feat(settings): add business memory editor with auto-save (T2.3)
feat(settings): add cursor defaults section for business (T2.4)
feat(settings): integrate all new sections into settings page (T2.5)
test(settings): branch and parallel settings validation tests
```

Push efter hvert commit: `git push origin feat/workspace-settings`

---

## Hvad du IKKE må gøre

- Ændre `lib/tasks/actions.ts` eller filer i `app/api/github/` — de tilhører S3/S4.
- Ændre `db/schema.ts` — S1 er done og merged.
- Køre `db:generate` eller `db:migrate` — ingen schema-ændringer i S2.
- Merge til `main` — PR er draft.

---

## Afslutning — din rapport skal indeholde

1. PR-URL.
2. Liste over commits med hash.
3. Output af `npm test` (grøn).
4. Screenshot eller beskrivelse af hver ny settings-sektion i UI.
5. Eventuelle afvigelser fra task-plan med begrundelse.
