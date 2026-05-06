"use client";

import { cn } from "@/lib/utils";

/** GitHub-synced PR lifecycle (from `tasks.github_pr_status`). */
export type TaskPrStatus = "draft" | "open" | "approved" | "merged" | "closed" | null | undefined;

const PR_BADGE: Record<Exclude<TaskPrStatus, null | undefined>, { label: string; className: string }> =
  {
    draft: {
      label: "Draft",
      className: "bg-muted-foreground/40 text-muted-foreground",
    },
    open: {
      label: "Open",
      className: "bg-amber-400/20 text-amber-500",
    },
    approved: {
      label: "Approved",
      className: "bg-blue-400/20 text-blue-500",
    },
    merged: {
      label: "Merged",
      className: "bg-emerald-500/20 text-emerald-600",
    },
    closed: {
      label: "Closed",
      className: "bg-destructive/20 text-destructive",
    },
  };

export function TaskPrBadge({ status }: { status: TaskPrStatus }) {
  if (!status) return null;
  const cfg = PR_BADGE[status];
  if (!cfg) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}
