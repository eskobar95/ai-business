# Sprints (`lib/sprints/`)

Sprint CRUD server actions for missions.

## Exports (`actions.ts`)

| Function | Description |
|----------|-------------|
| `createSprint(input)` | Insert a sprint for a mission. Verifies `missionId` belongs to the user's business. |
| `listSprintsByMission(businessId, missionId)` | Return all sprints for a mission, ordered by `createdAt` desc. |
| `updateSprintStatus(businessId, sprintId, status)` | Transition sprint status: `planning` → `active` → `completed`. |
| `deleteSprint(businessId, sprintId)` | Delete a sprint (cascades to linked tasks). |

## Status flow

```
planning → active → completed
```

Sprints are created in `planning` status by `runProductOwnerBriefing` (T5).  
`runEngineeringManagerDecomposition` (T7) transitions the sprint to `active` after task creation.

## Schema

The `sprints` table lives in `db/schema.ts`. Key columns:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `missionId` | uuid | FK → missions |
| `name` | text | e.g. "Sprint 1" |
| `goal` | text | Markdown — PO sprint brief output |
| `status` | enum | `planning` \| `active` \| `completed` |
| `startDate` / `endDate` | date | Optional planning dates |
| `createdAt` / `updatedAt` | timestamptz | UTC |
