"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import type { sprints as sprintsTable } from "@/db/schema";
import { activateSprint, deleteSprint, updateSprintStatus } from "@/lib/sprints/actions";
import { cn } from "@/lib/utils";

type SprintRow = typeof sprintsTable.$inferSelect;

const STATUS_BADGE: Record<string, string> = {
  planning: "bg-muted/60 text-muted-foreground border border-white/10",
  active: "bg-primary/15 text-primary border border-primary/30",
  completed: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
};

function formatDate(d: string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function SprintCardDetail({
  row,
  taskCount,
  onRefresh,
}: {
  row: SprintRow;
  taskCount: number;
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isActive = row.status === "active";

  function refresh() {
    if (onRefresh) onRefresh();
    else router.refresh();
  }

  function handleStatusChange(next: "planning" | "active" | "completed") {
    start(async () => {
      try {
        await updateSprintStatus(row.id, next);
        toast.success("Sprint updated.");
        refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      }
    });
  }

  function handleActivate() {
    start(async () => {
      try {
        await activateSprint(row.id);
        toast.success("Sprint activated.");
        refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Delete sprint "${row.name}"? Tasks stay but lose their sprint link.`)) return;
    start(async () => {
      try {
        await deleteSprint(row.id);
        toast.success("Sprint deleted.");
        refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  const startStr = formatDate(row.startDate);
  const endStr = formatDate(row.endDate);
  const goalSnippet = row.goal
    ? row.goal.length > 120
      ? row.goal.slice(0, 120) + "…"
      : row.goal
    : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow",
        isActive ? "border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
                STATUS_BADGE[row.status] ?? STATUS_BADGE.planning,
              )}
            >
              {row.status}
            </span>
            {(startStr || endStr) && (
              <span className="font-mono text-[10px] text-muted-foreground/50">
                {[startStr, endStr].filter(Boolean).join(" → ")}
              </span>
            )}
          </div>
          <p className={cn("text-[15px] font-semibold tracking-tight", isActive && "text-primary")}>
            {row.name}
          </p>
          {goalSnippet && (
            <p className="mt-1 max-w-xl text-[12px] text-muted-foreground">{goalSnippet}</p>
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
          onChange={(e) => handleStatusChange(e.target.value as "planning" | "active" | "completed")}
          aria-label={`${row.name} status`}
        >
          <option value="planning">planning</option>
          <option value="active">active</option>
          <option value="completed">completed</option>
        </select>

        {row.status !== "active" && (
          <button
            type="button"
            disabled={pending}
            onClick={handleActivate}
            className={cn(
              "cursor-pointer rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary",
              pending && "cursor-not-allowed opacity-50",
            )}
          >
            Activate
          </button>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={handleDelete}
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
