# PRD — Autonom Agent-orkestrering v1

**Status:** Klar til implementation  
**Dato:** Maj 2026  
**Scope:** Alt hvad der skal til for at platformen kan køre agents autonomt og sikkert fra end-to-end

---

## Vision

Et workspace definerer agenter, sprint-tasks og GitHub-repoer én gang. Herefter:

- En **lead-agent** orkestrerer sin taskliste autonomt (heartbeat-drevet).
- **Worker-agenter** modtager tasks via kø, starter med frisk kode fra `integrationBranch`, arbejder i isoleret git worktree, leverer via Draft PR.
- **Mennesket** (dig) godkender merge til `main`/release — intet automation rører release.
- Systemet er **deterministisk, sporbart og sikkert** — ingen silent starts, ingen race conditions, ingen dirty trees.

---

## Ikke-mål (v1)

- Hermes CLI som eksekveringsmotor (kun Cursor).
- Automatisk masse-promotion fra GitHub webhook alene.
- Env-styring af parallel-loft (kun workspace-setting).
- Tenant-specifikke system roles (globalt katalog i v1).
- Auto-gate mod `main`/release (kun `integrationBranch`).

---

## Beslutninger låst i design-session


| #   | Emne                      | Beslutning                                                                                                                              |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Task-status "todo"        | Nyt enum-trin. `backlog` = planlagt/ikke klar. `todo` = kø, auto-start tilladt når gates er grønne.                                     |
| 2   | Gates (AND)               | Dependency-task `done` **OG** linket PR merged til `integrationBranch` — kun når begge er sat; ellers kun det satte.                    |
| 3   | Promotion `backlog→todo`  | Kun: menneske med rettighed, team lead-agent, eller agent med `system_role.slug` på allowlist — alt scoped til business.                |
| 4   | Lead heartbeat            | Kører i **samme runner**; `lead_heartbeat` event-type; promotion cap pr. agent (default 3 pr. tick).                                    |
| 5   | Kø-model                  | Global FIFO; mutex pr. agent (ingen overlap for samme agent); optional business parallel-loft (nullable default = ubegrænset).          |
| 6   | Kommentar-trigger         | Ingen mention → trigger **assigned worker**. Eksplicit mention → trigger **alle nævnte agenter** (inkl. worker hvis nævnt).             |
| 7   | System roles              | Globalt katalog med **flags** (ikke kun slug). Flags styrer runner-adfærd, git-krav, promotion-ret, PR-gate.                            |
| 8   | Agent Role vs System Role | `agents.role` = fri tekst "Agent Role" (visuel titel). `system_role` = maskinkontrakt. Tooltips i UI.                                   |
| 9   | Execution profil          | Afledt af `system_role` flags, ikke agent-navn. Developer/analyst/ux/lead = forskellige regler.                                         |
| 10  | Business memory           | Synlig og redigerbar i workspace settings (ikke kun via Grill-Me wizard).                                                               |
| 11  | GitHub                    | GitHub App webhooks (HMAC-verificerede) som eneste autoritative PR-sandhed.                                                             |
| 12  | PR-merge gate             | Strict match: `repository` + `pull_request.base.ref === integrationBranch`.                                                             |
| 13  | Branch-konfiguration      | `integrationBranch` = auto-gate og frisk-sync-base. `releaseBranch` = UI/politik, kun menneskegodkendt merge.                           |
| 14  | PR-link på task           | `githubPrNumber` + `githubRepoInstallationId` — valideret mod linked installation.                                                      |
| 15  | Git-preflight i runner    | Deterministisk: fetch → checkout `integrationBranch` → checkout/sync PR-branch/worktree. Abort ved dirty tree. Log til agent activity.  |
| 16  | Cursor runtime            | Alle felter persisteret pr. agent i DB. `auto` = Cursor default (felt sendes ikke/auto-token). `inherit` = agent → business → platform. |
| 17  | Adapter-cap               | Promotion cap konfigureres på agent-settings; default 3 pr. heartbeat-tick.                                                             |
| 18  | Business parallel-loft    | Nullable felt på `businesses`; `null` = ubegrænset; aktiveres eksplicit i settings.                                                     |


---

## Funktionelle krav

### F1 — Task-livcyklus

**Statusser (ny samlet enum):**

```
backlog → todo → in_progress → blocked | in_review → done
```

- `**backlog**`: Planlagt. Kan have assignee og dependency. Ingen auto-trigger.
- `**todo**`: Klar til kørsel. Auto-trigger worker når gates er grønne.
- `**in_progress**`: Runner har startet agent-session.
- `**blocked**`: Eksplicit blokering med reason.
- `**in_review**`: Linked approval; afventer menneskegodkendelse.
- `**done**`: Leveret.

**Nye felter på `tasks`:**

- `dependencyTaskId uuid` — FK til anden task (same business); gate kræver den er `done`.
- `githubPrNumber integer` — PR-nummer på linked installation.
- `githubRepoInstallationId uuid` — FK til `github_installations`.
- `prMergedToIntegration boolean default false` — sættes af GitHub webhook-handler.
- `gatesLockedAt timestamptz` — hvornår alle gates sidst var lukket (audit).

---

### F2 — Promotion `backlog → todo`

**Må kun ske hvis:**

1. Caller er menneske med business-adgang **eller**
2. Caller er agent og opfylder: `teams.leadAgentId = agentId` (for det team task'en hører under) **eller** agent's `system_role.slug ∈ promotion_allowlist`.

`**promotion_allowlist`** er et platform-konfigureret sæt slugs (fx `engineering_manager`, `product_owner`, `lead`). Defineres som konstant i kode; kan gøres konfigurerbart pr. business senere.

---

### F3 — Auto-trigger fra `todo`

Når en task er `todo`, evaluerer runneren / lead-heartbeat om gates er opfyldt:

```
gate_ok =
  (dependencyTaskId IS NULL OR dependency.status = 'done')
  AND
  (githubPrNumber IS NULL OR prMergedToIntegration = true)
```

Kun når `gate_ok = true` må `webhook_trigger` oprettes og worker starte.

---

### F4 — Kommentar-routing

Ved nyt `task_log` med `authorType = 'human'`:

1. **Ingen `@handle` i tekst:** Opret `mention_trigger` for **assigned agent** (hvis task har `agentId`).
2. **Et eller flere `@handle`:** Opret `mention_trigger` for **alle matchede agenter** (case-insensitive navn-match i business). Worker trigges kun hvis `@worker` er eksplicit nævnt.

`mention_trigger` behandles af runner (i dag fejler det — se F9).

---

### F5 — Lead heartbeat

- Event-type: `lead_heartbeat`.
- Runner: FIFO; samme kø som `webhook_trigger`.
- Per-tick: lead-agent evaluerer tasks i businesss sprint-backlog og promoverer max `agent.heartbeatPromotionCap` (default 3) tasks til `todo` når gates er grønne og lead har promotion-ret.
- Lead-agent opretter evt. branches og Draft PRs (via GitHub API) som del af prompt-kontekst.
- Heartbeat-prompt indeholder: business memory + agent-soul + PR-status for relevante tasks.

---

### F6 — Kø og parallelisering

```
Runner-invarianter:
- Global FIFO på tværs af event-typer (createdAt ASC).
- Per-agent mutex: samme agentId kører aldrig overlappende.
- Optional business-loft: businesses.maxParallelRuns (nullable; null = ubegrænset).
- Samme runner-proces håndterer webhook_trigger + lead_heartbeat + (fixet) mention_trigger.
```

---

### F7 — Git-preflight (kun `system_role.requires_git_workspace = true`)

Rækkefølge:

1. `git fetch origin`
2. Verify working tree er clean (abort med fejl til agent-activity hvis ikke).
3. Checkout / sync `integrationBranch` (fra business/repo settings).
4. Hvis task har `githubPrNumber`: checkout PR-branch (eller opret git worktree med den branch).
5. Log alle steps til `orchestration_events` / agent-activity.

---

### F8 — System roles (flags)

Nye kolonner på `system_roles`:


| Kolonne                       | Type             | Betydning                                          |
| ----------------------------- | ---------------- | -------------------------------------------------- |
| `requires_git_workspace`      | boolean          | Runner kører git-preflight og worktree-logik       |
| `may_promote_backlog_to_todo` | boolean          | Agenten må promovere tasks                         |
| `requires_pr_merge_gate`      | boolean          | Gate-check inkluderer PR merged                    |
| `runs_heartbeat`              | boolean          | Agenten er lead-type; heartbeat-event tilladt      |
| `max_parallel_own_runs`       | integer nullable | Override pr. role (ellers per-agent mutex default) |


**Seed-roller (platform):**


| slug                     | Git | Promovere | PR-gate | Heartbeat |
| ------------------------ | --- | --------- | ------- | --------- |
| `engineer` / `developer` | ✓   | ✗         | ✓       | ✗         |
| `analyst` / `researcher` | ✗   | ✗         | ✗       | ✗         |
| `ux_designer`            | ✗   | ✗         | ✗       | ✗         |
| `engineering_manager`    | ✗   | ✓         | ✗       | ✓         |
| `product_owner`          | ✗   | ✓         | ✗       | ✓         |
| `lead`                   | ✓   | ✓         | ✓       | ✓         |


---

### F9 — Reparation af mention_trigger

I dag oprettes `mention_trigger`-events men runner fejler dem ("Unsupported orchestration type"). Reparation:

- Runner dispatcher udvidedes til at håndtere `mention_trigger` som et agent-run med en "respond to comment"-prompt.
- Alternativt: drop `mention_trigger` og map det direkte til `webhook_trigger` med `{ trigger: "mention", taskId, excerpt }` payload — én dispatcher, færre typer.

**Valgt tilgang: Map mention til `webhook_trigger` med mention-payload.** Simplere dispatcher, samme kø, ingen ny type.

---

### F10 — Cursor runtime felter på agent

Nye kolonner på `agents`:


| Kolonne                 | Type    | Default  | Semantik                                                     |
| ----------------------- | ------- | -------- | ------------------------------------------------------------ |
| `cursorModelId`         | text    | `'auto'` | `'auto'` = Cursor default; `'inherit'` = business → platform |
| `cursorThinkingEffort`  | text    | `'auto'` | Samme semantik                                               |
| `cursorRuntimeProfile`  | text    | `'auto'` | Reserveret til fremtidig Cursor runtime-valg                 |
| `heartbeatPromotionCap` | integer | `3`      | Max promotions pr. lead-heartbeat-tick                       |


Business-niveau defaults (nye kolonner på `businesses` eller separat `businessSettings`):


| Kolonne                       | Type    | Default                               |
| ----------------------------- | ------- | ------------------------------------- |
| `defaultCursorModelId`        | text    | `null` (platform bruger `composer-2`) |
| `defaultCursorThinkingEffort` | text    | `null`                                |
| `maxParallelRuns`             | integer | `null` (ubegrænset)                   |
| `integrationBranch`           | text    | `null` (kræves før eksekvering)       |
| `releaseBranch`               | text    | `null` (UI/politik kun)               |


---

### F11 — Business memory i settings

- Eksisterende memory-rækker (scope: `business`) vises og kan redigeres i `/dashboard/settings` under "Workspace Memory".
- Editor: markdown/rich text; auto-save som i dag på task-description.
- Ny memory-sektion kan tilføjes manuelt (ekstra markdown-blok).
- Grill-Me-wizard forbliver som onboarding-flow men er ikke eneste vej.

---

### F12 — GitHub PR-status i UI og DB

**Webhook flow:**

1. GitHub sender `pull_request` event (opened, synchronize, closed/merged).
2. Backend verificerer HMAC (eksisterende `WEBHOOK_SECRET` pattern).
3. Match `repository.full_name` mod `github_installations`.
4. Ved merged + `base.ref === business.integrationBranch`: sæt `tasks.prMergedToIntegration = true` for tasks med matchende `githubPrNumber`.
5. Log til `orchestration_events` (type: `github.pr.merged`).

**Task-UI:**

- Vis PR-status-badge på task-kort og task-detail: `draft` / `open` / `approved` / `merged` — hentet fra nyt DB-felt `githubPrStatus text`.
- Ny kolonne: `githubPrStatus text` (opdateres af webhook).

---

## Ikke-funktionelle krav

- **Idempotens**: GitHub webhooks behandles med eksisterende idempotency-key-mønster.
- **HMAC-verifikation**: Alle indgående GitHub webhooks verificeres med `x-hub-signature-256`.
- **Abort-sikkerhed**: Dirty git tree afbryder med fejl-log inden SDK-start — aldrig silent.
- **Audit trail**: Alle state-overgange (gate åbnet, promotion, PR merged, git-preflight) logges i `orchestration_events`.
- **Secrets**: GitHub App private key og webhook secret kun server-side; aldrig i client eller log.
- **Tests**: Enhedstest pr. ny Server Action og dispatcher-funktion; integration test for gate-evaluering og kommentar-routing.

---

## Minimum readiness gate (før eksekvering)

Systemet afviser runner-start og returnerer beskrivende fejl hvis:

1. Ingen aktiv `github_installations` med matchende repo for det PR-link der er sat.
2. `business.integrationBranch` ikke sat.
3. `business.localPath` ikke tilgængeligt på runner-host.
4. Ingen gyldig Cursor API-key (workspace-bruger eller `CURSOR_API_KEY` fallback).
5. Ingen business-scope memory (mindst én række i `memory` for business).

---

## Arkitektur-overblik (v1)

```
Human / UI
  │
  ├─ backlog → todo (promotion gated)
  ├─ kommentar → comment routing → webhook_trigger (mention)
  └─ GitHub merged → prMergedToIntegration = true

Lead agent (heartbeat, lead_heartbeat event)
  ├─ Evaluerer gates (dep done + PR merged)
  ├─ Promoverer max N tasks til todo
  └─ Opretter feature branch / Draft PR via GitHub API

Runner (poll loop, FIFO)
  ├─ webhook_trigger (worker run)
  │   ├─ Readiness check
  │   ├─ Git preflight (kræves for code-profil)
  │   ├─ Agent.create → SDK run
  │   └─ Log output → task_log + orchestration_event
  └─ lead_heartbeat
      ├─ Evaluer + promover
      └─ Log til orchestration_events

GitHub App
  └─ Webhook → PR merged → DB update → UI badge
```

