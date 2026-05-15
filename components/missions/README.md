# Missions UI

Mission list, create form, detail tabs (PRD, sprints, tasks, approvals), and sprint helpers for the dashboard.

## Files

- `mission-card.tsx` — card linking to `/dashboard/missions/[id]`.
- `mission-form.tsx` — client create form (`MissionCreateForm`).
- `mission-detail-tabs.tsx` — tabbed mission editor and sprint/task views.
- `sprint-form.tsx` / `sprint-card.tsx` — sprint create and status UI.

Server actions live in `lib/missions/actions.ts` and `lib/sprints/actions.ts`.
