# Platform V1.0 — Completion Report

**Dato:** 15. maj 2026  
**Status:** Alle 8 tasks merget til `main`

---

## Hvad er Platform V1.0?

AI Business Platform er et orkestreringsværktøj for AI-drevne teams. Mennesker godkender; Cursor CLI kører agenter lokalt. V1.0 etablerer den komplette brugerrejse fra onboarding til aktive agenter: business onboarding → mission oprettelse → PO sprint brief → godkendelse → EM task-dekomponering → agenter arbejder.

---

## Implementerede tasks

### T1 — Rename projects → missions
**Branch:** `feat/rename-projects-to-missions`  
**Migration:** `0023_fix_rename_projects_to_missions.sql`

`projects`-tabellen er omdøbt til `missions` med tilhørende FK-omdøbninger (`project_id` → `mission_id`). Alle routes, server actions, komponenter og typer er opdateret. `/dashboard/projects` redirecter til `/dashboard/missions`.

### T2 — Conductor platform default agent
**Branch:** `feat/conductor-platform-default`  
**Migration:** `0022_conductor_platform_default.sql` (`is_platform_default` boolean på `agents`)

`seedConductorAgent(businessId)` kaldes automatisk ved oprettelse af ny business og upserts en platform-default Conductor-agent med system-prompt skabelon. Conductor vises i agent-listen med "Platform"-badge og kan ikke slettes fra UI.

### T3 — Mission kickoff wizard (4 trin)
**Branch:** `feat/mission-kickoff-wizard`  
**Migration:** `0024_black_thunderbird.sql` (`validation_contract` + `project_type` på `missions`)

Erstatter den simple missions-formular med en 4-trins guided wizard: Type+navn → Mål → Valideringskontrakt (acceptance criteria) → Review+opret. Wizard bevarer state ved trin-skift og gemmer `validation_contract` og `project_type` på missionen.

**Nye filer:**
- `app/dashboard/missions/new/mission-wizard.tsx`
- `app/dashboard/missions/new/page.tsx` (erstattet)

### T4 — Sprint UI på missions-siden
**Branch:** `feat/sprint-ui`

Gør `sprints`-tabellen synlig. Missions-detaljesiden viser sprint-liste med status-badges (Planning/Active/Completed), inline opret-form og mulighed for at opdatere sprint-status.

**Nye filer:**
- `lib/sprints/actions.ts` — `createSprint`, `listSprintsByMission`, `updateSprintStatus`
- `app/dashboard/missions/[missionId]/sprint-list.tsx`
- `app/dashboard/missions/[missionId]/sprint-card.tsx`
- `app/dashboard/missions/[missionId]/create-sprint-form.tsx`

### T5 — runProductOwnerBriefing server action
**Branch:** `feat/po-briefing-action`

Broen fra "mission oprettet" til "agenter arbejder". Server action bygger et simuleret PO sprint brief (TODO: wire `runCursorAgent`), opretter sprint med `status='planning'`, og opretter en `pending` approval — alt i én DB-transaktion for at forhindre TOCTOU-races og partial failures.

**Nye filer:**
- `lib/missions/po-briefing-action.ts` — `runProductOwnerBriefing`
- `app/dashboard/missions/[missionId]/po-brief-button.tsx` — klientknap med loading/success/error states

### T6 — Team-scopede task-views
**Branch:** `feat/team-scoped-task-views`

Sidebar Issues-links under hvert team inkluderer nu `?teamId=[id]` så hvert team får sin egen task-visning. Tasks-siden læser `teamId` fra searchParams, validerer mod businessens teams, og filtrerer tasks. Aktivt team vises som breadcrumb med clear-filter-link over kanban-boardet.

**Ændrede filer:**
- `lib/tasks/actions.ts` — optional `teamId` filter
- `app/dashboard/tasks/page.tsx` — læser `teamId` searchParam
- `components/tasks/tasks-kanban-board.tsx` — `activeTeamName` breadcrumb
- Sidebar-komponent — `?teamId=` på Issues-links

### T7 — EM task-dekomponering action
**Branch:** `feat/em-decomposition-action`

Afslutter handoff fra Product Team til Engineering Team. Efter en godkendt PO sprint brief dekomponerer Engineering Manager briefet til 5 konkrete backlog-tasks (tech_lead, software_engineer, qa_engineer, security_reviewer, devops_engineer) og aktiverer sprint — alt i én transaktion. Gentagne kald afvises når sprint ikke længere er i `planning`.

**Nye filer:**
- `lib/missions/em-decompose-action.ts` — `runEngineeringManagerDecomposition`
- `app/dashboard/approvals/[approvalId]/em-decompose-button.tsx` — klientknap (kun på godkendte PO brief approvals)

**Ændret:**
- `app/dashboard/approvals/[approvalId]/page.tsx` — integrerer EM-knap

### T8 — Empty states med Conductor-link
**Branch:** `feat/empty-states-conductor`

First-time UX: tomme dashboard-, missions- og tasks-sider guider nu business owner med klare CTAs og et link til Conductor-agenten. `ConductorNudge` er en genbrugelig async server-komponent der slår Conductor op dynamisk (`is_platform_default=true`) og returnerer `null` hvis ingen conductor eksisterer.

**Nye filer:**
- `components/dashboard/conductor-nudge.tsx` — `ConductorNudge` komponent

**Ændrede filer:**
- `app/dashboard/page.tsx` — empty state med mission CTA + Conductor-link
- `app/dashboard/missions/page.tsx` — forbedret empty state
- `app/dashboard/tasks/page.tsx` — empty state med missions-link + Conductor-link

---

## Komplet brugerrejse (V1.0)

```
1. Onboarding (Grill-Me)
   └─ Business soul opfanges → Conductor-agent seedes automatisk

2. Missions
   └─ "Opret første mission" CTA eller Conductor-vejledning
   └─ 4-trins wizard: type → mål → valideringskontrakt → review
   └─ Mission oprettes med status='draft'

3. PO Briefing
   └─ "Kickstart Product Owner"-knap på missions-detaljesiden
   └─ runProductOwnerBriefing → sprint ('planning') + approval ('pending')

4. Godkendelse
   └─ Business owner reviewerer sprint brief på /dashboard/approvals
   └─ Approve / Reject med kommentar

5. EM Dekomponering
   └─ "Start Engineering Manager"-knap på godkendt approval
   └─ runEngineeringManagerDecomposition → 5 backlog tasks + sprint ('active')

6. Tasks → agenter arbejder
   └─ Team-scopede task-views på /dashboard/tasks?teamId=...
   └─ Kanban board per team
```

---

## Tekniske noter

### Database-ændringer i V1.0

| Migration | Ændring |
|-----------|---------|
| `0022` | `agents.is_platform_default boolean` |
| `0023` | `projects` → `missions` (tabel + FK rename) |
| `0024` | `missions.validation_contract text`, `missions.project_type text` |

### Transaktionssikkerhed
T5 og T7 bruger `db.transaction()` til at wrappe existence-check + insert-operationer. Dette forhindrer TOCTOU-races ved concurrent kald og sikrer atomicitet (ingen orphan sprints/tasks ved partial failure).

### MVP-simulering
T5 og T7 simulerer PO- og EM-output deterministisk. Når agent runtime er klar, erstattes de markerede `// TODO: wire runCursorAgent` blokke med reelle agent-kald.

### Worktree-workflow
Alle tasks er kørt parallelt i isolerede git worktrees under `.worktrees/` (gitignored). Branches er slettet efter merge.

---

## Udestående (næste fase)

| Prioritet | Opgave |
|-----------|--------|
| Høj | Wire `runCursorAgent` i T5 og T7 når agent runtime er klar |
| Høj | Cursor CLI local runner integration med webhook-triggers |
| Medium | Products-lag (langsigtet container over missions) |
| Medium | Approval-kommentar notifikationer |
| Lav | Sprint burndown / velocity metrics |
