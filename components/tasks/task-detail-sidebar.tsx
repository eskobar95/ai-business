"use client";

import { useRef, useState, useTransition, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GitFork,
  Check,
  Link2,
  Hash,
  GitBranch,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOutsideClick } from "@/hooks/use-outside-click";
import {
  LABEL_OPTIONS,
  STATUS_DOT,
} from "@/lib/tasks/task-detail-display";
import { slugifyTaskTitleSegment } from "@/lib/tasks/task-detail-helpers";
import type { TaskRelationItem } from "@/lib/tasks/task-detail-types";
import {
  updateTaskLabels,
  updateTaskProject,
  addTaskRelation,
  removeTaskRelation,
  updateTaskDependency,
} from "@/lib/tasks/actions";
import type { Priority } from "@/lib/tasks/task-detail-display";
import type { TaskStatus } from "@/lib/tasks/task-tree";
import {
  AssigneeDropdown,
  PriorityDropdown,
  StatusDropdown,
} from "@/components/tasks/task-detail-dropdowns";
import { TaskPrLinkForm } from "@/components/tasks/task-pr-link-form";
import { TaskGateStatus } from "@/components/tasks/task-gate-status";

function dependencyDepBadgeClass(status: string): string {
  if (status === "done") return "text-emerald-500/85";
  if (status === "in_progress") return "text-amber-400/85";
  return "text-muted-foreground/50";
}

function BlockedBySection({
  taskId,
  initialDependency,
  allTasks,
}: {
  taskId: string;
  initialDependency: { id: string; title: string; status: string } | null;
  allTasks: {
    id: string;
    title: string;
    status: string;
    priority: string | null;
    project: string | null;
  }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialDependency?.id ?? "");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setValue(initialDependency?.id ?? "");
  }, [initialDependency?.id]);

  const selectedFromList = value ? allTasks.find((t) => t.id === value) : null;
  const selected =
    selectedFromList ??
    (initialDependency && initialDependency.id === value ? initialDependency : null);

  function onSelect(next: string) {
    setValue(next);
    const depId = next.length > 0 ? next : null;
    startTransition(async () => {
      try {
        await updateTaskDependency(taskId, depId);
        router.refresh();
      } catch {
        toast.error("Failed to update dependency");
        setValue(initialDependency?.id ?? "");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <label htmlFor="task-dependency-select" className="sr-only">
          Blocked by task
        </label>
        <select
          id="task-dependency-select"
          value={value}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[12px] text-foreground/80 outline-none focus:border-white/[0.16]"
        >
          <option value="">No dependency</option>
          {(initialDependency && !allTasks.some((t) => t.id === initialDependency.id)
            ? [
                {
                  id: initialDependency.id,
                  title: initialDependency.title,
                  status: initialDependency.status,
                  priority: null as string | null,
                  project: null as string | null,
                },
              ]
            : []
          )
            .concat(allTasks.filter((t) => t.id !== taskId))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.status})
              </option>
            ))}
        </select>
        <button
          type="button"
          title="Task cannot auto-start (todo) until this task is done."
          className="shrink-0 rounded px-1.5 font-mono text-[11px] text-muted-foreground/35 hover:text-muted-foreground/60"
          aria-label="Dependency help"
        >
          ?
        </button>
      </div>
      {selected ? (
        <p className={cn("text-[11px]", dependencyDepBadgeClass(selected.status))}>
          Dependency status:{" "}
          <span className="font-medium capitalize">{selected.status.replaceAll("_", " ")}</span>
        </p>
      ) : null}
    </div>
  );
}

export function SidebarSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-white/[0.05]">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground/30 mb-1.5">{label}</p>
      <div className="text-[13px] text-foreground/70">{children}</div>
    </div>
  );
}

/** Compact label + value row inside Properties group */
export function PropertiesRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-h-[30px]">
      <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground/30">{label}</span>
      <div className="flex-1 min-w-0 text-[13px] text-foreground/70">{children}</div>
    </div>
  );
}

export function SidebarToolbar({
  taskId,
  taskTitle,
  businessId,
}: {
  taskId: string;
  taskTitle: string;
  businessId: string;
}) {
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`, { duration: 1500 });
    } catch {
      toast.error("Copy failed");
    }
  }

  const shortId = taskId.slice(0, 8);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/dashboard/tasks/${taskId}?businessId=${encodeURIComponent(businessId)}`
      : "";
  const branch = `feat/${shortId}-${slugifyTaskTitleSegment(taskTitle)}`;

  return (
    <div className="h-14 flex items-center gap-1 px-3 border-b border-white/[0.06] shrink-0">
      <ToolbarCopyBtn label="Link" icon={<Link2 className="size-3" />} onClick={() => copy(link, "Link")} />
      <ToolbarCopyBtn label="ID" icon={<Hash className="size-3" />} onClick={() => copy(shortId, "ID")} />
      <ToolbarCopyBtn
        label="Branch"
        icon={<GitBranch className="size-3" />}
        onClick={() => copy(branch, "Git branch")}
      />
    </div>
  );
}

function ToolbarCopyBtn({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground/35 hover:text-foreground/65 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.09] transition-all"
    >
      {icon}
      {label}
    </button>
  );
}

function LabelsSection({
  taskId,
  initialLabels,
}: {
  taskId: string;
  initialLabels: string[];
}) {
  const [labels, setLabels] = useState<string[]>(initialLabels);
  const [popupOpen, setPopupOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setPopupOpen(false), popupOpen);

  function toggle(name: string) {
    const next = labels.includes(name) ? labels.filter((l) => l !== name) : [...labels, name];
    setLabels(next);
    startTransition(async () => {
      try {
        await updateTaskLabels(taskId, next);
      } catch {
        toast.error("Failed to update labels");
        setLabels(labels);
      }
    });
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex flex-wrap gap-1 mt-0.5 min-h-[20px]">
        {labels.length === 0 && (
          <span className="text-[12px] text-muted-foreground/30 italic">None</span>
        )}
        {labels.map((name) => {
          const opt = LABEL_OPTIONS.find((o) => o.name === name);
          const color = opt?.color ?? "#6b7280";
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              title="Remove label"
              style={{
                borderColor: `${color}33`,
                backgroundColor: `${color}14`,
                color,
              }}
              className="label-chip-animate inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] hover:opacity-70 transition-opacity cursor-pointer"
            >
              {name}
              <X className="size-2.5 opacity-60" />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setPopupOpen((v) => !v)}
          className="inline-flex items-center justify-center size-5 rounded-full border border-border text-muted-foreground/30 hover:text-foreground/50 hover:bg-white/[0.05] transition-colors"
        >
          <Plus className="size-3" />
        </button>
      </div>
      {popupOpen && (
        <div className="dropdown-animate absolute left-0 top-full mt-1 z-50 w-48 rounded-lg border border-white/[0.10] bg-popover shadow-2xl py-1">
          {LABEL_OPTIONS.map((opt) => {
            const active = labels.includes(opt.name);
            return (
              <button
                key={opt.name}
                type="button"
                onClick={() => toggle(opt.name)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] hover:bg-white/[0.06] transition-colors"
              >
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                <span className="text-foreground/70">{opt.name}</span>
                {active && <Check className="ml-auto size-3 text-primary/70" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjectField({
  taskId,
  initialProject,
}: {
  taskId: string;
  initialProject: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialProject ?? "");
  const [, startTransition] = useTransition();

  function save() {
    const trimmed = value.trim();
    setEditing(false);
    startTransition(async () => {
      try {
        await updateTaskProject(taskId, trimmed || null);
      } catch {
        toast.error("Failed to update project");
        setValue(initialProject ?? "");
      }
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setValue(initialProject ?? "");
            setEditing(false);
          }
        }}
        className="w-full bg-transparent border-b border-white/[0.15] outline-none text-[13px] text-foreground/80 pb-0.5"
        placeholder="e.g. MercFlow v2"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-[13px] text-left w-full hover:text-foreground/90 transition-colors cursor-text"
    >
      {value ? (
        <span className="text-foreground/70">{value}</span>
      ) : (
        <span className="text-muted-foreground/35">Add project…</span>
      )}
    </button>
  );
}

function RelationsSection({
  taskId,
  businessId,
  initialRelations,
  allTasks,
}: {
  taskId: string;
  businessId: string;
  initialRelations: TaskRelationItem[];
  allTasks: {
    id: string;
    title: string;
    status: string;
    priority?: string | null;
    project?: string | null;
  }[];
}) {
  const router = useRouter();
  const [relations, setRelations] = useState<TaskRelationItem[]>(initialRelations);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const blocks = relations.filter((r) => r.relationType === "blocks");
  const blockedBy = relations.filter((r) => r.relationType === "blocked_by");
  const related = relations.filter((r) => r.relationType === "related");

  const filtered = allTasks
    .filter((t) => t.id !== taskId && !relations.some((r) => r.linkedTaskId === t.id))
    .filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  function handleAdd(linkedTask: { id: string; title: string; status: string }, relType: string) {
    const optimistic: TaskRelationItem = {
      id: `temp-${Date.now()}`,
      relationType: relType,
      linkedTaskId: linkedTask.id,
      linkedTaskTitle: linkedTask.title,
      linkedTaskStatus: linkedTask.status,
    };
    setRelations((prev) => [...prev, optimistic]);
    setAddingFor(null);
    setQuery("");

    startTransition(async () => {
      try {
        const { id } = await addTaskRelation(businessId, taskId, linkedTask.id, relType);
        setRelations((prev) => prev.map((r) => (r.id === optimistic.id ? { ...r, id } : r)));
        router.refresh();
      } catch {
        toast.error("Failed to add relation");
        setRelations((prev) => prev.filter((r) => r.id !== optimistic.id));
      }
    });
  }

  function handleRemove(id: string) {
    setRelations((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      try {
        await removeTaskRelation(id);
        router.refresh();
      } catch {
        toast.error("Failed to remove relation");
        setRelations(initialRelations);
      }
    });
  }

  function RelationGroup({
    label,
    items,
    relType,
  }: {
    label: string;
    items: TaskRelationItem[];
    relType: string;
  }) {
    return (
      <div className="mb-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/25 mb-1.5">
          {label}
        </p>
        {items.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-1.5 py-1 group rounded px-1 -mx-1 hover:bg-white/[0.03]"
          >
            <span
              className={cn(
                "size-1.5 rounded-full shrink-0",
                STATUS_DOT[r.linkedTaskStatus as TaskStatus] ?? "bg-muted-foreground/30",
              )}
            />
            <Link
              href={`/dashboard/tasks/${r.linkedTaskId}?businessId=${encodeURIComponent(businessId)}`}
              className="flex-1 text-[12px] text-foreground/60 hover:text-foreground/90 truncate transition-colors"
            >
              {r.linkedTaskTitle}
            </Link>
            <button
              type="button"
              onClick={() => handleRemove(r.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/30 hover:text-destructive/70"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {addingFor === relType ? (
          <div className="mt-1">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAddingFor(null);
                  setQuery("");
                }
              }}
              placeholder="Search tasks…"
              className="w-full bg-white/[0.04] border border-border rounded px-2 py-1 text-[12px] text-foreground/70 outline-none focus:border-white/[0.18] transition-colors placeholder:text-muted-foreground/25"
            />
            {filtered.length > 0 && (
              <div className="dropdown-animate mt-1 rounded-md border border-border bg-popover py-0.5 max-h-40 overflow-y-auto">
                {filtered.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleAdd(t, relType)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-[12px] text-foreground/60 hover:bg-white/[0.06] hover:text-foreground/80 transition-colors text-left"
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        STATUS_DOT[t.status as TaskStatus] ?? "bg-muted-foreground/30",
                      )}
                    />
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAddingFor(relType);
              setQuery("");
            }}
            className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
          >
            <Plus className="size-3" /> Add
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <RelationGroup label="Blocks" items={blocks} relType="blocks" />
      <RelationGroup label="Blocked by" items={blockedBy} relType="blocked_by" />
      <RelationGroup label="Related" items={related} relType="related" />
    </div>
  );
}

export type TaskDetailSidebarProps = {
  taskId: string;
  taskTitle: string;
  businessId: string;
  labels: string[];
  project: string | null;
  approvalId: string | null;
  initialRelations: TaskRelationItem[];
  allTasks: {
    id: string;
    title: string;
    status: string;
    priority: string | null;
    project: string | null;
  }[];
  createdLabel: string;
  updatedLabel: string;
  status: TaskStatus;
  priority: Priority;
  agentId: string | null;
  statusPending: boolean;
  priorityPending: boolean;
  assigneePending: boolean;
  allAgents: { id: string; name: string }[];
  onStatusChange: (s: TaskStatus) => void;
  onPriorityChange: (p: Priority) => void;
  onAssigneeChange: (id: string | null) => void;
  dependencyTask: { id: string; title: string; status: string } | null;
  githubInstallations: { id: string; label: string }[];
  integrationBranch: string | null;
  githubPrNumber: number | null;
  githubRepoInstallationId: string | null;
  githubPrStatus: string | null;
  prMergedToIntegration: boolean;
};

export function TaskDetailSidebar(props: TaskDetailSidebarProps) {
  const {
    taskId,
    taskTitle,
    businessId,
    labels,
    project,
    approvalId,
    initialRelations,
    allTasks,
    createdLabel,
    updatedLabel,
    status,
    priority,
    agentId,
    statusPending,
    priorityPending,
    assigneePending,
    allAgents,
    onStatusChange,
    onPriorityChange,
    onAssigneeChange,
    dependencyTask,
    githubInstallations,
    integrationBranch,
    githubPrNumber,
    githubRepoInstallationId,
    githubPrStatus,
    prMergedToIntegration,
  } = props;

  return (
    <>
      <SidebarToolbar taskId={taskId} taskTitle={taskTitle} businessId={businessId} />
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-white/[0.05]">
          <p className="px-4 pt-3 pb-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/25">
            Properties
          </p>
          <div className="px-4 pb-3 flex flex-col gap-0.5">
            <PropertiesRow label="Status">
              <StatusDropdown value={status} onChange={onStatusChange} disabled={statusPending} />
            </PropertiesRow>
            <PropertiesRow label="Priority">
              <PriorityDropdown value={priority} onChange={onPriorityChange} disabled={priorityPending} />
            </PropertiesRow>
            <PropertiesRow label="Assignee">
              <AssigneeDropdown value={agentId} agents={allAgents} onChange={onAssigneeChange} disabled={assigneePending} />
            </PropertiesRow>
          </div>
        </div>

        <SidebarSection label="Labels">
          <LabelsSection taskId={taskId} initialLabels={labels} />
        </SidebarSection>

        <SidebarSection label="Project">
          <ProjectField taskId={taskId} initialProject={project} />
        </SidebarSection>

        <SidebarSection label="Blocked by">
          <BlockedBySection taskId={taskId} initialDependency={dependencyTask} allTasks={allTasks} />
        </SidebarSection>

        {(status === "todo" || status === "backlog") &&
        (dependencyTask != null || githubPrNumber != null) ? (
          <SidebarSection label="Gate status">
            <TaskGateStatus
              taskStatus={status}
              dependencyTask={dependencyTask}
              prMergedToIntegration={prMergedToIntegration}
              githubPrStatus={githubPrStatus}
              githubPrNumber={githubPrNumber}
              integrationBranch={integrationBranch}
            />
          </SidebarSection>
        ) : null}

        <SidebarSection label="Approval">
          {approvalId ? (
            <span className="flex items-center gap-1.5 text-[12.5px] text-primary/60">
              <GitFork className="size-3" />
              Linked approval
            </span>
          ) : (
            <span className="text-muted-foreground/35">–</span>
          )}
        </SidebarSection>

        <SidebarSection label="Pull request">
          <TaskPrLinkForm
            key={`${taskId}-${githubPrNumber ?? ""}-${githubRepoInstallationId ?? ""}-${githubPrStatus ?? ""}`}
            taskId={taskId}
            initialGithubPrNumber={githubPrNumber}
            initialGithubRepoInstallationId={githubRepoInstallationId}
            githubPrStatus={githubPrStatus}
            installations={githubInstallations}
          />
        </SidebarSection>

        <SidebarSection label="Relations">
          <RelationsSection
            taskId={taskId}
            businessId={businessId}
            initialRelations={initialRelations}
            allTasks={allTasks}
          />
        </SidebarSection>

        <SidebarSection label="Created">
          <span className="text-muted-foreground/60">{createdLabel}</span>
        </SidebarSection>
        <SidebarSection label="Updated">
          <span className="text-muted-foreground/60">{updatedLabel}</span>
        </SidebarSection>
      </div>
    </>
  );
}
