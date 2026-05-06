# Tasks domain (`lib/tasks`)

Server Actions and helpers for business-scoped **tasks**, **task logs**, and **@mention** orchestration triggers.

## Files

| File | Role |
|------|------|
| `actions.ts` | `"use server"` — CRUD, `getTaskById`, subtree delete, tree listing, `updateTaskStatus` (backlog→`todo` → promotion + `logEvent`), `promoteTaskToTodo`, dependency updates (**cycle check**), PR link updates, installations list |
| `promotion-auth.ts` | `assertMayPromoteToTodo` — human vs agent RBAC; policy is DB flags on `system_roles`, not slug allowlists in code |
| `log-actions.ts` | `"use server"` — append log lines and fetch logs; human-authored logs trigger mention parsing |
| `mention-trigger.ts` | Scans log text for `@Name`, matches agents in the same business (case-insensitive), emits `orchestration_events` with `type: mention_trigger` (`status: pending`) |
| `task-tree.ts` | Types: `TaskRow`, `TaskStatus`, `TaskTreeNode`. Pure helpers: subtree collection and safe delete ordering (children before parents) |
| `flatten-task-tree.ts` | Pure `flattenTaskTree` for kanban listings (depth-first over `TaskTreeNode[]`) |
| `dashboard-queries.ts` | Signed-in user's per-business task counts (in progress, blocked) for dashboard cards |
| `task-detail-display.ts` | Pure helpers/constants for task detail UI (`relativeTime`, label/priority/status maps). |
| `task-detail-types.ts` | `LogEntry`, `TaskRelationItem` shapes shared by task detail client modules. |
| `task-detail-helpers.ts` | Pure helpers (`slugifyTaskTitleSegment`, `getAuthorLabel`, `getMonogram`, `hastToHtml` for highlighted code in comments). Tests: `__tests__/task-detail-helpers.test.ts`. |

## Usage

- Import actions only from **Server Components**, Route Handlers, or other Server Actions — not from Client Components (`AGENTS.md` boundary).
- `authorId` on task logs is a **text** identifier (e.g. session user id or agent id), aligned with `task_logs.author_id`.

## Tests

```bash
npm test -- lib/tasks
```
