"use client";

import { cn } from "@/lib/utils";

/** GitHub-synced PR lifecycle (from `tasks.github_pr_status`). */
export type TaskPrStatus = "draft" | "open" | "approved" | "merged" | "closed" | null | undefined;

const PR_BADGE: Record<Exclude<TaskPrStatus, null | undefined>, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "border border-border bg-muted text-muted-foreground",
  },
  open: {
    label: "Open",
    className: "border border-amber-500/25 bg-amber-500/15 text-amber-500",
  },
  approved: {
    label: "Approved",
    className: "border border-blue-500/25 bg-blue-500/10 text-blue-500",
  },
  merged: {
    label: "Merged",
    className: "border border-emerald-500/30 bg-emerald-500/15 text-emerald-600",
  },
  closed: {
    label: "Closed",
    className: "border border-destructive/30 bg-destructive/10 text-destructive",
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
