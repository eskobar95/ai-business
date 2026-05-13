# Missions (server actions)

Business-scoped **missions** (PRD + sprints) replace the former `projects` domain.

## Exports (`actions.ts`)

- `createMission` — insert mission row for a business the user can access.
- `updateMission` / `deleteMission` — mutate by mission id with ownership checks.
- `listMissionsOverview` — list missions with sprint/task counts.
- `getMissionBundle` — mission with sprints, linked tasks, and approvals whose `artifactRef` references the mission (`kind: mission` or legacy `kind: project`).

Sprint CRUD lives in `lib/sprints/actions.ts` (`createSprint`, etc.).
