# Tasks UI (`components/tasks`)

Client and server components for **Phase 2 Task 3.2**: task board, creation form, detail activity feed, and status updates.

| File | Role |
|------|------|
| `task-card.tsx` | Link card for a task (title, assignee, team, status snippet). |
| `task-status-board.tsx` | Five-column board (Backlog → Done) using `TaskCard`. |
| `task-log-feed.tsx` | Chronological log with markdown body; labels humans as “You” when ids match. |
| `task-comment-input.tsx` | Client textarea + submit calling `appendTaskLog` (`human` + session user id). |
| `task-create-form.tsx` | Client form calling `createTask` with optional agent, team, parent task. |
| `task-status-select.tsx` | Client dropdown calling `updateTaskStatus`. |
| `task-detail-client.tsx` | Task detail shell: header, description editor autosave path, layout, handlers; delegates sidebar + activity. |
| `task-detail-dropdowns.tsx` | Status, priority, assignee, team metadata dropdowns. |
| `task-detail-sidebar.tsx` | Properties column: toolbar copies, rows, labels, project, PR link, relations, dates. |
| `task-detail-activity.tsx` | Activity feed (+ demo rows), highlighted comment HTML, composer `CommentBox`. |
| `task-detail-priority-icon.tsx` | Priority SVG icons for task detail dropdowns. |
| `task-pr-badge.tsx` | Small lifecycle badge for `tasks.github_pr_status` (`draft` / `open` / `approved` / `merged` / `closed`). |

Imports `appendTaskLog` / `createTask` / `updateTaskStatus` only from client components where required; list pages stay as Server Components.
