# Missions (server actions)

Business-scoped **missions** (PRD + sprints) replace the former `projects` domain.

## Exports (`actions.ts`)

- `createMission` — insert mission row for a business the user can access.
- `updateMission` / `deleteMission` — mutate by mission id with ownership checks.
- `listMissionsOverview` — list missions with sprint/task counts.
- `getMissionBundle` — mission with sprints, linked tasks, and approvals whose `artifactRef` references the mission (`kind: mission` or legacy `kind: project`).

Sprint CRUD lives in `lib/sprints/actions.ts` (`createSprint`, etc.).

## Product Owner / Engineering flows

- `po-briefing-action.ts` — `runProductOwnerBriefing`: Cursor Cloud agent (no `local.cwd`) + `buildRepoContextForPrompt`; falls back to simulated markdown if no API key or agent failure. Uses roster **product_owner** soul from `load-agent-soul.ts`.
- `em-decompose-action.ts` — `runEngineeringManagerDecomposition`: same pattern with JSON-in-fence parsing via `em-parse.ts`; falls back to simulated tasks if no key, parse failure, or agent error. Uses **engineering_manager** soul from `load-agent-soul.ts`.
- `load-agent-soul.ts` — loads `agent_documents.slug === "soul"` for a roster agent (Enterprise template).
- `em-parse.ts` — `parseEmTasksFromOutput` for EM JSON task arrays.
