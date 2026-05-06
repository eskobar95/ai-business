"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Columns2, GitFork, List, Plus, SquarePen } from "lucide-react";

import { Card } from "@/components/ui/card";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { TaskCreateModal } from "@/components/tasks/task-create-modal";
import { cn } from "@/lib/utils";
import { updateTaskStatus } from "@/lib/tasks/actions";
import type { TaskRow, TaskStatus } from "@/lib/tasks/task-tree";

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "Todo" },
  { id: "in_progress", title: "In Progress" },
  { id: "blocked", title: "Blocked" },
  { id: "in_review", title: "In Review" },
  { id: "done", title: "Done" },
];

const STATUS_DOT: Record<TaskStatus, string> = {
  backlog: "bg-muted-foreground/30",
  todo: "bg-indigo-400 animate-pulse",
  in_progress: "bg-primary animate-pulse",
  blocked: "bg-destructive",
  in_review: "bg-amber-400",
  done: "bg-emerald-500",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In progress",
  blocked: "Blocked",
  in_review: "In review",
  done: "Done",
};

const COL_ACCENT: Record<TaskStatus, string> = {
  backlog: "text-muted-foreground/50",
  todo: "text-indigo-400",
  in_progress: "text-primary",
  blocked: "text-destructive",
  in_review: "text-amber-400",
  done: "text-emerald-500",
};

function buildColumnItemIds(grouped: Record<TaskStatus, TaskRow[]>) {
  const m: Record<string, string[]> = {};
  for (const c of COLUMNS) {
    m[c.id] = (grouped[c.id] ?? []).map((t) => t.id);
  }
  return m;
}

function findColumn(map: Record<string, string[]>, taskId: string) {
  for (const [col, ids] of Object.entries(map)) {
    if (ids.includes(taskId)) return col;
  }
  return undefined;
}

function buildItemMap(grouped: Record<TaskStatus, TaskRow[]>) {
  const m: Record<string, TaskRow> = {};
  for (const c of COLUMNS) {
    for (const t of grouped[c.id] ?? []) {
      m[t.id] = t;
    }
  }
  return m;
}

function KanbanCard({
  task,
  agentName,
  teamName,
  onOpen,
  isDragOverlay,
  isNew,
}: {
  task: TaskRow;
  agentName: string | null;
  teamName: string | null;
  onOpen?: () => void;
  isDragOverlay?: boolean;
  isNew?: boolean;
}) {
  return (
    <div
      data-testid={`task-card-${task.id}`}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={onOpen ? (e) => e.key === "Enter" && onOpen() : undefined}
      className={cn(
        "group w-full rounded-md border border-border bg-card px-3 py-2.5",
        "transition-all duration-150",
        onOpen && "cursor-pointer hover:border-white/[0.14] hover:bg-white/[0.02]",
        isDragOverlay && "border-white/[0.14] bg-card",
        isNew && "animate-slide-in-up",
      )}
    >
      {/* Row 1: status dot + title + agent monogram */}
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-[5px] size-1.5 shrink-0 rounded-full",
            STATUS_DOT[task.status],
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="block truncate text-[12.5px] font-medium leading-snug text-foreground/90 tracking-[-0.01em]">
              {task.title}
            </span>
            {agentName ? (
              <span className="shrink-0 inline-flex size-5 items-center justify-center rounded bg-white/[0.08] font-mono text-[9px] font-semibold text-foreground/50">
                {agentName.slice(0, 2).toUpperCase()}
              </span>
            ) : null}
          </div>

          {/* Row 2: meaningful chips */}
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

          {/* Blocked reason */}
          {task.status === "blocked" && task.blockedReason ? (
            <span className="mt-1.5 block text-[11px] text-destructive/70 line-clamp-2 leading-snug">
              {task.blockedReason}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: "board" | "list";
  onChange: (v: "board" | "list") => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
      <button
        type="button"
        onClick={() => onChange("board")}
        className={cn(
          "flex h-6 cursor-pointer items-center gap-1.5 rounded px-2 text-[11px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
          view === "board"
            ? "bg-white/[0.08] text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Columns2 className="size-3" /> Board
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={cn(
          "flex h-6 cursor-pointer items-center gap-1.5 rounded px-2 text-[11px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
          view === "list"
            ? "bg-white/[0.08] text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="size-3" /> List
      </button>
    </div>
  );
}

function ListView({
  grouped,
  agentNames,
  teamNames,
  openTask,
}: {
  grouped: Record<TaskStatus, TaskRow[]>;
  agentNames: Record<string, string>;
  teamNames: Record<string, string>;
  businessId: string;
  openTask: (id: string) => void;
}) {
  const hasAny = COLUMNS.some((col) => (grouped[col.id] ?? []).length > 0);

  if (!hasAny) {
    return (
      <Card padding="py-16" className="flex items-center justify-center">
        <span className="font-mono text-[11px] text-muted-foreground/30">No tasks</span>
      </Card>
    );
  }

  return (
    <Card padding="" className="overflow-hidden">
      {COLUMNS.map((col) => {
        const tasks = grouped[col.id] ?? [];
        if (tasks.length === 0) return null;
        return (
          <div key={col.id}>
            {/* Status group header */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2">
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-[0.08em]",
                  COL_ACCENT[col.id],
                )}
              >
                {col.title}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/35">
                {tasks.length}
              </span>
            </div>
            {/* Task rows */}
            {tasks.map((task, i) => (
              <button
                key={task.id}
                type="button"
                onClick={() => openTask(task.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
                  i < tasks.length - 1 && "border-b border-white/[0.04]",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    STATUS_DOT[task.status],
                  )}
                />
                <span className="flex-1 truncate text-[12.5px] font-medium tracking-[-0.01em] text-foreground/85">
                  {task.title}
                </span>
                <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground/40">
                  {task.agentId ? (agentNames[task.agentId] ?? "—") : "Unassigned"}
                  {task.teamId && teamNames[task.teamId]
                    ? ` · ${teamNames[task.teamId]}`
                    : ""}
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </Card>
  );
}

export function TasksKanbanBoard({
  grouped,
  agentNames,
  teamNames,
  businessId,
  agents,
  teams,
}: {
  grouped: Record<TaskStatus, TaskRow[]>;
  agentNames: Record<string, string>;
  teamNames: Record<string, string>;
  businessId: string;
  agents: { id: string; name: string }[];
  teams: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"board" | "list">("board");
  const [columnItemIds, setColumnItemIds] = useState(() => buildColumnItemIds(grouped));
  const [localItems, setLocalItems] = useState<Record<string, TaskRow>>(() => buildItemMap(grouped));
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultModalStatus, setDefaultModalStatus] = useState<TaskStatus>("backlog");
  const prevRef = useRef(columnItemIds);

  useEffect(() => {
    const next = buildColumnItemIds(grouped);
    setColumnItemIds(next);
    setLocalItems(buildItemMap(grouped));
    prevRef.current = next;
  }, [grouped]);

  useEffect(() => {
    prevRef.current = columnItemIds;
  }, [columnItemIds]);

  const onColumnItemIdsChange = useCallback(
    (next: Record<string, string[]>) => {
      const prev = prevRef.current;
      const allIds = new Set([...Object.values(prev).flat(), ...Object.values(next).flat()]);

      for (const id of allIds) {
        const from = findColumn(prev, id);
        const to = findColumn(next, id);
        if (from && to && from !== to) {
          void updateTaskStatus(id, to as TaskStatus)
            .then(() => router.refresh())
            .catch(() => router.refresh());
          break;
        }
      }

      setColumnItemIds(next);
    },
    [router],
  );

  const openTask = useCallback(
    (taskId: string) => {
      router.push(`/dashboard/tasks/${taskId}?businessId=${encodeURIComponent(businessId)}`);
    },
    [router, businessId],
  );

  const handleTaskCreated = useCallback(
    (task: TaskRow) => {
      setLocalItems((prev) => ({ ...prev, [task.id]: task }));
      setColumnItemIds((prev) => ({
        ...prev,
        [task.status]: [...(prev[task.status] ?? []), task.id],
      }));
      setNewlyAddedId(task.id);
      setTimeout(() => setNewlyAddedId(null), 600);
      setTimeout(() => router.refresh(), 1000);
    },
    [router],
  );

  const openModal = useCallback((status: TaskStatus = "backlog") => {
    setDefaultModalStatus(status);
    setModalOpen(true);
  }, []);

  return (
    <div>
      {/* Toolbar row */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => openModal("backlog")}
          className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-[12px] font-medium text-muted-foreground/70 transition-colors duration-150 hover:bg-white/[0.04] hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
        >
          <SquarePen className="size-3" />
          New task
        </button>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {view === "board" ? (
        <div data-testid="task-status-board">
          <KanbanBoard<TaskRow>
            columns={COLUMNS}
            columnItemIds={columnItemIds}
            getItem={(id) => localItems[id]}
            onColumnItemIdsChange={onColumnItemIdsChange}
            renderColumnHeader={(col, count) => (
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.06em]",
                    COL_ACCENT[col.id as TaskStatus],
                  )}
                >
                  {col.title}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground/35 tabular-nums">
                  {count}
                </span>
              </div>
            )}
            renderCard={(task, isDragOverlay) => (
              <KanbanCard
                task={task}
                agentName={task.agentId ? (agentNames[task.agentId] ?? null) : null}
                teamName={task.teamId ? (teamNames[task.teamId] ?? null) : null}
                onOpen={isDragOverlay ? undefined : () => openTask(task.id)}
                isDragOverlay={isDragOverlay}
                isNew={task.id === newlyAddedId}
              />
            )}
            renderColumnFooter={(col) => (
              <button
                type="button"
                onClick={() => openModal(col.id as TaskStatus)}
                className="flex w-full cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-[11px] text-muted-foreground/30 transition-colors duration-150 hover:text-muted-foreground/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
              >
                <Plus className="size-3" /> Add task
              </button>
            )}
          />
        </div>
      ) : (
        <ListView
          grouped={grouped}
          agentNames={agentNames}
          teamNames={teamNames}
          businessId={businessId}
          openTask={openTask}
        />
      )}

      <TaskCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleTaskCreated}
        businessId={businessId}
        agents={agents}
        teams={teams}
        defaultStatus={defaultModalStatus}
      />
    </div>
  );
}

// Re-export for consumers that only need the status label map
export { STATUS_LABEL };
