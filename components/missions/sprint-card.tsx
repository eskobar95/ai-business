"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { activateSprint, deleteSprint, updateSprint } from "@/lib/sprints/actions";
import { cn } from "@/lib/utils";
import type { sprints as sprintsTable } from "@/db/schema";

type SprintRow = typeof sprintsTable.$inferSelect;

export function SprintCard({
  row,
  taskCount,
  onRefresh,
}: {
  row: SprintRow;
  taskCount: number;
  onRefresh: () => void;
}) {
  const [pending, start] = useTransition();

  function setStatus(next: string) {
    start(async () => {
      try {
        await updateSprint(row.id, { status: next });
        toast.success("Sprint updated.");
        onRefresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      }
    });
  }

  function onActivate() {
    start(async () => {
      try {
        await activateSprint(row.id);
        toast.success("Sprint activated.");
        onRefresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function onDelete() {
    if (!confirm(`Delete sprint "${row.name}"? Tasks stay but lose sprint link.`)) return;
    start(async () => {
      try {
        await deleteSprint(row.id);
        toast.success("Sprint deleted.");
        onRefresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] text-muted-foreground/40">{row.status}</p>
          <p className="text-[15px] font-semibold tracking-tight">{row.name}</p>
          {row.goal && (
            <p className="mt-1 max-w-xl text-[12px] text-muted-foreground">{row.goal}</p>
          )}
        </div>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/40">{taskCount} tasks</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
        <select
          className={cn(
            "cursor-pointer rounded-md border border-border bg-muted/40 px-2 py-1.5 text-[12px] outline-none",
            pending && "pointer-events-none opacity-50",
          )}
          value={row.status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={`${row.name} status`}
        >
          <option value="planning">planning</option>
          <option value="active">active</option>
          <option value="completed">completed</option>
        </select>
        <button
          type="button"
          disabled={pending}
          onClick={onActivate}
          className={cn(
            "cursor-pointer rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary",
            pending && "cursor-not-allowed opacity-50",
          )}
        >
          Activate
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onDelete}
          className={cn(
            "ml-auto cursor-pointer rounded-md px-3 py-1.5 text-[12px] text-destructive/70 hover:bg-destructive/10",
            pending && "cursor-not-allowed opacity-50",
          )}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
