# Missions (server actions)

Business-scoped **missions** (PRD + sprints) replace the former `projects` domain.

## Exports (`actions.ts`)

- `createMission` — insert mission row for a business the user can access.
- `updateMission` / `deleteMission` — mutate by mission id with ownership checks.
- `listMissionsOverview` — list missions with sprint/task counts.
- `getMissionBundle` — mission with sprints, linked tasks, and approvals whose `artifactRef` references the mission (`kind: mission` or legacy `kind: project`).

Sprint CRUD lives in `lib/sprints/actions.ts` (`createSprint`, etc.).

## Product Owner / Engineering flows

- `po-briefing-action.ts` — `runProductOwnerBriefing`: creates a sprint (`planning`) + approval artifact (`artifactType: po_sprint_brief`).
- `em-decompose-action.ts` — `runEngineeringManagerDecomposition`: after the PO sprint brief approval, creates backlog tasks from simulated EM output and moves the sprint to `active` (single DB transaction).
