"use client";

import {
  useState,
  useEffect,
  useRef,
  useTransition,
  useCallback,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, PanelRight } from "lucide-react";
import { toast } from "sonner";
import { TiptapEditor } from "@/components/ui/tiptap-editor";
import { cn } from "@/lib/utils";
import { ActivityFeed, CommentBox } from "@/components/tasks/task-detail-activity";
import { TaskDetailSidebar } from "@/components/tasks/task-detail-sidebar";
import { relativeTime } from "@/lib/tasks/task-detail-display";
import type {
  TaskRelationItem,
  LogEntry,
} from "@/lib/tasks/task-detail-types";
import {
  updateTask,
  updateTaskStatus,
  updateTaskPriority,
  updateTaskAssignee,
  updateTaskTeam,
} from "@/lib/tasks/actions";
import type { Priority } from "@/lib/tasks/task-detail-display";
import type { TaskRow, TaskStatus } from "@/lib/tasks/task-tree";

type SaveStatus = "idle" | "pending" | "saving" | "saved";

type Props = {
  task: TaskRow;
  agentName: string | null;
  teamName: string | null;
  agentId: string | null;
  teamId: string | null;
  logs: LogEntry[];
  agentNames: Record<string, string>;
  currentUserId: string;
  businessId: string;
  allAgents: { id: string; name: string }[];
  allTeams: { id: string; name: string }[];
  taskRelations: TaskRelationItem[];
  allTasks: { id: string; title: string; status: string; priority: string | null; mission: string | null }[];
  dependencyTask: { id: string; title: string; status: string } | null;
  githubInstallations: { id: string; label: string }[];
  integrationBranch: string | null;
};

function DescriptionEditor({
  taskId,
  initialDescription,
  onSaveStatus,
}: {
  taskId: string;
  initialDescription: string;
  onSaveStatus: (status: SaveStatus, savedAt?: Date) => void;
}) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHtmlRef = useRef<string | null>(null);

  const executeSave = useCallback(
    async (html: string) => {
      onSaveStatus("saving");
      try {
        await updateTask(taskId, { description: html });
        pendingHtmlRef.current = null;
        onSaveStatus("saved", new Date());
      } catch {
        onSaveStatus("idle");
        toast.error("Failed to save description");
      }
    },
    [taskId, onSaveStatus],
  );

  const handleUpdate = useCallback(
    (html: string) => {
      pendingHtmlRef.current = html;
      onSaveStatus("pending");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => executeSave(html), 3000);
    },
    [executeSave, onSaveStatus],
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (pendingHtmlRef.current) void executeSave(pendingHtmlRef.current);
    };
  }, [executeSave]);

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (pendingHtmlRef.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return (
    <TiptapEditor
      initialContent={initialDescription}
      placeholder="Add a description…  type / for commands"
      onUpdate={handleUpdate}
    />
  );
}

export function TaskDetailClient({
  task,
  agentName: _agentName,
  teamName: _teamName,
  agentId: initialAgentId,
  teamId: initialTeamId,
  logs,
  agentNames,
  currentUserId,
  businessId,
  allAgents,
  allTeams: _allTeams,
  taskRelations: initialRelations,
  allTasks,
  dependencyTask,
  githubInstallations,
  integrationBranch,
}: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(task.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titlePending, titleTransition] = useTransition();

  const [description] = useState(task.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [statusPending, statusTransition] = useTransition();

  const [priority, setPriority] = useState<Priority>((task.priority as Priority) ?? "medium");
  const [priorityPending, priorityTransition] = useTransition();

  const [agentId, setAgentId] = useState<string | null>(initialAgentId ?? null);
  const [assigneePending, assigneeTransition] = useTransition();

  const [teamId, setTeamId] = useState<string | null>(initialTeamId ?? null);
  const [teamPending, teamTransition] = useTransition();

  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const handleSaveStatus = useCallback((s: SaveStatus, at?: Date) => {
    setSaveStatus(s);
    if (at) setSavedAt(at);
  }, []);

  function handleSaveTitle() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(task.title);
      setEditingTitle(false);
      return;
    }
    if (trimmed === task.title) {
      setEditingTitle(false);
      return;
    }
    titleTransition(async () => {
      try {
        await updateTask(task.id, { title: trimmed });
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update title");
        setTitle(task.title);
      }
      setEditingTitle(false);
    });
  }

  function handleStatusChange(next: TaskStatus) {
    setStatus(next);
    statusTransition(async () => {
      try {
        await updateTaskStatus(task.id, next);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update status");
        setStatus(task.status);
      }
    });
  }

  function handlePriorityChange(next: Priority) {
    setPriority(next);
    priorityTransition(async () => {
      try {
        await updateTaskPriority(task.id, next);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update priority");
        setPriority((task.priority as Priority) ?? "medium");
      }
    });
  }

  function handleAssigneeChange(next: string | null) {
    setAgentId(next);
    assigneeTransition(async () => {
      try {
        await updateTaskAssignee(task.id, next);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update assignee");
        setAgentId(initialAgentId ?? null);
      }
    });
  }

  function handleTeamChange(next: string | null) {
    setTeamId(next);
    teamTransition(async () => {
      try {
        await updateTaskTeam(task.id, next);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update team");
        setTeamId(initialTeamId ?? null);
      }
    });
  }

  const createdLabel = new Date(task.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const updatedLabel = new Date(task.updatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const blockedByRelations = initialRelations.filter((r) => r.relationType === "blocked_by");

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="h-14 shrink-0 flex items-center gap-2 px-8 border-b border-white/[0.06]">
          <Link
            href={`/dashboard/tasks?businessId=${encodeURIComponent(businessId)}`}
            data-testid="task-detail-back"
            className="font-mono text-[11px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
          >
            ← Tasks
          </Link>
          <span className="font-mono text-[11px] text-muted-foreground/20">/</span>
          <span className="font-mono text-[11px] text-muted-foreground/30 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded">
            #{task.id.slice(0, 8)}
          </span>
          <span className="ml-auto flex items-center gap-3 font-mono text-[10px]">
            {saveStatus === "saving" ? (
              <>
                <Loader2 className="size-3 animate-spin text-muted-foreground/30" />
                <span className="text-muted-foreground/30">Saving…</span>
              </>
            ) : (
              <span className="text-muted-foreground/25">
                Updated {relativeTime(savedAt ?? new Date(task.updatedAt))}
              </span>
            )}
            <button
              type="button"
              className="xl:hidden flex size-7 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-white/[0.06] hover:text-muted-foreground/70"
              onClick={() => setRightSidebarOpen((o) => !o)}
              aria-label={rightSidebarOpen ? "Hide properties" : "Show properties"}
            >
              <PanelRight className="size-3.5" />
            </button>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-8 py-6">
            {blockedByRelations.length > 0 && (
              <div className="banner-animate mb-5 flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-4 py-2.5">
                <AlertCircle className="size-3.5 text-amber-400/70 shrink-0" />
                <p className="text-[12px] text-amber-400/80">
                  Blocked by {blockedByRelations.length}{" "}
                  {blockedByRelations.length === 1 ? "issue" : "issues"}
                </p>
              </div>
            )}

            {editingTitle ? (
              <input
                data-testid="task-detail-title"
                className="text-[22px] font-semibold tracking-tight bg-transparent border-b border-white/[0.15] text-foreground/90 w-full outline-none pb-0.5 mb-5"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") {
                    setTitle(task.title);
                    setEditingTitle(false);
                  }
                }}
                disabled={titlePending}
                autoFocus
              />
            ) : (
              <h1
                data-testid="task-detail-title"
                className="text-[22px] font-semibold tracking-tight text-foreground/90 cursor-text hover:text-foreground transition-colors mb-5"
                onClick={() => setEditingTitle(true)}
              >
                {title}
              </h1>
            )}

            <div className="mb-8">
              <DescriptionEditor
                taskId={task.id}
                initialDescription={description}
                onSaveStatus={handleSaveStatus}
              />
            </div>

            {status === "blocked" && task.blockedReason ? (
              <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
                <p className="text-[12px] text-destructive/80">{task.blockedReason}</p>
              </div>
            ) : null}

            <div className="border-t border-white/[0.06] pt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground/35 mb-4">
                Activity
              </p>
              <ActivityFeed logs={logs} agentNames={agentNames} currentUserId={currentUserId} />
              <CommentBox
                taskId={task.id}
                currentUserId={currentUserId}
                agentNames={agentNames}
                allTasks={allTasks}
              />
            </div>
          </div>
        </div>
      </div>

      {rightSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm xl:hidden"
          aria-label="Close properties"
          onClick={() => setRightSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "w-[260px] shrink-0 border-l border-border flex-col overflow-hidden",
          "hidden xl:flex",
          rightSidebarOpen &&
            "!flex fixed inset-y-0 right-0 z-50 bg-background shadow-2xl shadow-black/60 xl:relative xl:inset-auto xl:shadow-none",
        )}
      >
        <TaskDetailSidebar
          taskId={task.id}
          taskTitle={task.title}
          businessId={businessId}
          labels={(task.labels as string[]) ?? []}
          mission={task.mission ?? null}
          approvalId={task.approvalId}
          initialRelations={initialRelations}
          allTasks={allTasks}
          createdLabel={createdLabel}
          updatedLabel={updatedLabel}
          status={status}
          priority={priority}
          agentId={agentId}
          statusPending={statusPending}
          priorityPending={priorityPending}
          assigneePending={assigneePending}
          allAgents={allAgents}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onAssigneeChange={handleAssigneeChange}
          dependencyTask={dependencyTask}
          githubInstallations={githubInstallations}
          integrationBranch={integrationBranch}
          githubPrNumber={task.githubPrNumber ?? null}
          githubRepoInstallationId={task.githubRepoInstallationId ?? null}
          githubPrStatus={task.githubPrStatus ?? null}
          prMergedToIntegration={task.prMergedToIntegration}
        />
      </aside>
    </div>
  );
}
