import type { TaskStatus } from "@/lib/tasks/task-tree";

/** Compact relative time string for activity timestamps. */
export function relativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const LABEL_OPTIONS = [
  { name: "Feature", color: "#10b981" },
  { name: "Bug", color: "#ef4444" },
  { name: "Frontend", color: "#3b82f6" },
  { name: "Backend", color: "#8b5cf6" },
  { name: "Urgent", color: "#f59e0b" },
  { name: "Internal", color: "#6b7280" },
  { name: "human-required", color: "#06b6d4" },
  { name: "Docs", color: "#84cc16" },
] as const;

export type Priority = "urgent" | "high" | "medium" | "low" | "none";

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "text-orange-400/90" },
  high: { label: "High", color: "text-foreground/65" },
  medium: { label: "Medium", color: "text-foreground/55" },
  low: { label: "Low", color: "text-foreground/40" },
  none: { label: "No priority", color: "text-muted-foreground/35" },
};

export const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low", "none"];

export const STATUSES: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "blocked",
  "in_review",
  "done",
];

export const STATUS_DOT: Record<TaskStatus, string> = {
  backlog: "bg-muted-foreground/30",
  todo: "bg-indigo-400 animate-pulse",
  in_progress: "bg-primary animate-pulse",
  blocked: "bg-destructive",
  in_review: "bg-amber-400",
  done: "bg-emerald-500",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In progress",
  blocked: "Blocked",
  in_review: "In review",
  done: "Done",
};
