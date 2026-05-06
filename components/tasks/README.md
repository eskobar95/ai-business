# Tasks UI (`components/tasks`)

Client and server components for **Phase 2 Task 3.2**: task board, creation form, detail activity feed, and status updates.

| File | Role |
|------|------|
| `task-card.tsx` | Link card for a task (title, assignee, team, status snippet). |
| `task-status-board.tsx` | Five-column board (Backlog → Done) using `TaskCard`. |
| `task-log-feed.tsx` | Chronological log with markdown body; labels humans as “You” when ids match. |
| `task-comment-input.tsx` | Client textarea + submit calling `appendTaskLog` (`human` + session user id). |
| `task-create-form.tsx` | Client form calling `createTask` with optional agent, team, parent task. |
| `task-status-select.tsx` | Client select: uses `promoteTaskToTodo` when moving backlog → todo, else `updateTaskStatus`. |
| `task-detail-client.tsx` | Task detail shell: header, description editor autosave path, layout, handlers; delegates sidebar + activity; promotion path for backlog → todo. |
| `task-detail-dropdowns.tsx` | Status, priority, assignee, team metadata dropdowns; todo status includes gate tooltip. |
| `task-detail-sidebar.tsx` | Properties column: toolbar copies, blocked-by dependency picker, gate summary, approval vs GitHub PR link form, relations, dates. |
| `task-pr-link-form.tsx` | Client form: repo installation + PR number → `updateTaskPrLink`. |
| `task-pr-badge.tsx` | Minimal PR status chip (stub until S3 full badge). |
| `task-gate-status.tsx` | Read-only gate summary (dependency + PR merge to integration branch). |
| `tasks-kanban-board.tsx` | Drag-and-drop board; backlog → todo drag uses `promoteTaskToTodo`. |
| `task-detail-activity.tsx` | Activity feed (+ demo rows), highlighted comment HTML, composer `CommentBox`. |
| `task-detail-priority-icon.tsx` | Priority SVG icons for task detail dropdowns. |

Imports `appendTaskLog` / `createTask` / `updateTaskStatus` only from client components where required; list pages stay as Server Components.
