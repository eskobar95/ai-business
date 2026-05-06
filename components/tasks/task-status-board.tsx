import type { TaskStatus } from "@/lib/tasks/task-tree";
import type { TaskRow } from "@/lib/tasks/task-tree";

import { TaskCard } from "./task-card";

const COLUMN_ORDER: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "blocked",
  "in_review",
  "done",
];

const COLUMN_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In progress",
  blocked: "Blocked",
  in_review: "In review",
  done: "Done",
};

export function TaskStatusBoard({
  grouped,
  agentNames,
  teamNames,
  businessId,
}: {
  grouped: Record<TaskStatus, TaskRow[]>;
  agentNames: Record<string, string>;
  teamNames: Record<string, string>;
  businessId: string;
}) {
  return (
    <div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      data-testid="task-status-board"
    >
      {COLUMN_ORDER.map((status) => (
        <section
          key={status}
          className="border-border bg-muted/20 flex min-h-[200px] flex-col gap-2 rounded-lg border p-3"
          data-testid={`task-column-${status}`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-foreground text-sm font-semibold">{COLUMN_LABEL[status]}</h2>
            <span className="text-muted-foreground text-xs tabular-nums">
              {grouped[status]?.length ?? 0}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {(grouped[status] ?? []).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                businessId={businessId}
                agentName={task.agentId ? (agentNames[task.agentId] ?? null) : null}
                teamName={task.teamId ? (teamNames[task.teamId] ?? null) : null}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
