import Link from "next/link";
import { GitFork } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TaskRow, TaskStatus } from "@/lib/tasks/task-tree";

const STATUS_DOT: Record<TaskStatus, string> = {
  backlog: "bg-muted-foreground/40",
  todo: "bg-indigo-400",
  in_progress: "bg-primary animate-pulse",
  blocked: "bg-destructive",
  in_review: "bg-amber-400",
  done: "bg-emerald-500",
};

export function TaskCard({
  task,
  businessId,
  agentName,
  teamName,
  showLabels = true,
}: {
  task: TaskRow;
  businessId: string;
  agentName: string | null;
  teamName: string | null;
  showLabels?: boolean;
}) {
  const href = `/dashboard/tasks/${task.id}?businessId=${encodeURIComponent(businessId)}`;

  return (
    <Link
      href={href}
      data-testid={`task-card-${task.id}`}
      className={cn(
        "group block rounded-md border border-border bg-card px-3 py-2.5",
        "hover:border-white/[0.14] hover:bg-white/[0.02] transition-all duration-150 cursor-pointer",
      )}
    >
      {/* Row 1: status dot + title + agent monogram */}
      <div className="flex items-start gap-2">
        <span className={cn("mt-[5px] size-1.5 shrink-0 rounded-full", STATUS_DOT[task.status])} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="block truncate text-[13px] font-medium leading-snug text-foreground/90 tracking-[-0.01em]">
              {task.title}
            </span>
            {agentName ? (
              <span className="shrink-0 inline-flex size-5 items-center justify-center rounded bg-white/[0.08] font-mono text-[9px] font-semibold text-foreground/50">
                {agentName.slice(0, 2).toUpperCase()}
              </span>
            ) : null}
          </div>

          {/* Row 2: meaningful chips */}
          {showLabels ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {task.teamId && teamName ? (
                <span className="flex items-center gap-1 font-mono text-[10px] border border-border bg-white/[0.04] rounded px-1.5 py-0.5 text-muted-foreground/45">
                  <span className="size-1 rounded-full bg-blue-400/50 shrink-0" />
                  {teamName.slice(0, 3).toUpperCase()}
                </span>
              ) : (
                <span className="font-mono text-[10px] border border-border bg-white/[0.04] rounded px-1.5 py-0.5 text-muted-foreground/45">
                  Feature
                </span>
              )}
              {task.approvalId ? (
                <span className="flex items-center gap-0.5 font-mono text-[10px] border border-border bg-white/[0.04] rounded px-1.5 py-0.5 text-primary/60">
                  <GitFork className="size-2.5" />
                  ↑ 1 PR
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Blocked reason */}
          {task.status === "blocked" && task.blockedReason ? (
            <span className="mt-1.5 block text-[11px] text-destructive/70 line-clamp-2 leading-snug">
              {task.blockedReason}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
