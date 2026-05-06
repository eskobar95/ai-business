"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import type { TaskStatus } from "@/lib/tasks/task-tree";
import { updateTaskStatus } from "@/lib/tasks/actions";

const OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "in_review", label: "In review" },
  { value: "done", label: "Done" },
];

export function TaskStatusSelect({
  taskId,
  initialStatus,
  hideLabel = false,
}: {
  taskId: string;
  initialStatus: TaskStatus;
  hideLabel?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className={hideLabel ? undefined : "flex flex-col gap-1"}>
      {!hideLabel && (
        <label className="text-sm font-medium" htmlFor="task-detail-status">
          Status
        </label>
      )}
      <select
        id="task-detail-status"
        data-testid="task-detail-status"
        className={
          hideLabel
            ? "bg-transparent text-[13px] text-foreground/70 focus:outline-none cursor-pointer border-none"
            : "border-border bg-background max-w-xs cursor-pointer rounded-md border px-3 py-2 text-sm"
        }
        disabled={pending}
        value={initialStatus}
        onChange={(e) => {
          const next = e.target.value as TaskStatus;
          startTransition(async () => {
            try {
              await updateTaskStatus(taskId, next);
              toast.success("Status updated.");
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Update failed");
            }
          });
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
