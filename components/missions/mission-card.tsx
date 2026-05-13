import Link from "next/link";

import type { missions } from "@/db/schema";
import { cn } from "@/lib/utils";

export type MissionListItem = typeof missions.$inferSelect & {
  sprintCount: number;
  taskCount: number;
};

function statusTone(status: string) {
  const map: Record<string, string> = {
    draft: "border-white/[0.1] bg-white/[0.04] text-muted-foreground",
    active: "border-primary/30 bg-primary/10 text-primary",
    completed: "border-success/30 bg-success/10 text-success",
    archived: "border-border bg-muted/30 text-muted-foreground",
  };
  return map[status] ?? map.draft;
}

function stripHtmlSnippet(html: string, len: number): string {
  if (!html) return "";
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

export function MissionCard({ row, businessId }: { row: MissionListItem; businessId: string }) {
  const preview = stripHtmlSnippet(row.prd, 140);
  return (
    <Link
      href={`/dashboard/missions/${row.id}?businessId=${encodeURIComponent(businessId)}`}
      className={cn(
        "flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card",
        "p-4 transition-all duration-200 hover:border-primary/25 hover:bg-white/[0.02]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">{row.name}</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground/35">
            {new Date(row.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-medium capitalize",
            statusTone(row.status),
          )}
        >
          {row.status}
        </span>
      </div>

      <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
        {preview || "No PRD content yet"}
      </p>

      <div className="flex gap-4 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wide">
        <span>
          sprints <span className="ml-1 text-foreground/70 tabular-nums">{row.sprintCount}</span>
        </span>
        <span>
          tasks <span className="ml-1 text-foreground/70 tabular-nums">{row.taskCount}</span>
        </span>
      </div>
    </Link>
  );
}
