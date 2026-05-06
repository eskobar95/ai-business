# Routines

Scheduled recurring agent actions (cron + human-readable label + prompt).

| File | Purpose |
|------|---------|
| `queries.ts` | `listRoutinesByAgentId` for server components. |
| `actions.ts` | `createRoutine`, `updateRoutine`, `deleteRoutine` Server Actions with Zod validation. |

## Scheduler

`next_run_at` is left `null` until a cron runner lands; see TODO in `actions.ts` for invoking `POST /agent/spawn`.
