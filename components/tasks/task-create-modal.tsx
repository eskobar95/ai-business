"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { createTask } from "@/lib/tasks/actions";
import type { TaskRow, TaskStatus } from "@/lib/tasks/task-tree";
import { TaskCreateModalMetaBarPart } from "@/components/tasks/task-create-modal-meta-bar-part";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (task: TaskRow) => void;
  businessId: string;
  agents: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  defaultStatus?: TaskStatus;
};

export function TaskCreateModal({
  open,
  onClose,
  onCreated,
  businessId,
  agents,
  teams,
  defaultStatus,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descMode, setDescMode] = useState<"write" | "preview">("write");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus ?? "backlog");
  const [agentId, setAgentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const [openDropdown, setOpenDropdown] = useState<
    "status" | "agent" | "team" | null
  >(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const metaBarRef = useRef<HTMLDivElement>(null);

  // Mount/unmount with animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Reset form state when opened
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setDescMode("write");
      setStatus(defaultStatus ?? "backlog");
      setAgentId("");
      setTeamId("");
      setBlockedReason("");
      setOpenDropdown(null);
      setTimeout(() => titleRef.current?.focus(), 220);
    }
  }, [open, defaultStatus]);

  // Escape closes modal
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openDropdown) {
          setOpenDropdown(null);
        } else {
          onClose();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        handleSubmit();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, openDropdown]);

  // Outside-click closes dropdowns
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      if (
        metaBarRef.current &&
        !metaBarRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdown]);

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleSubmit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || isPending) return;

    startTransition(async () => {
      try {
        const result = await createTask(businessId, {
          title: trimmedTitle,
          description: description.trim() || undefined,
          agentId: agentId || null,
          teamId: teamId || null,
          status,
          blockedReason:
            status === "blocked" ? blockedReason.trim() || null : null,
        });

        const optimistic: TaskRow = {
          id: result.id,
          businessId,
          title: trimmedTitle,
          description: description.trim(),
          status,
          agentId: agentId || null,
          teamId: teamId || null,
          parentTaskId: null,
          dependencyTaskId: null,
          githubPrNumber: null,
          githubRepoInstallationId: null,
          githubPrStatus: null,
          prMergedToIntegration: false,
          gatesLockedAt: null,
          priority: "medium",
          labels: [],
          mission: null,
          missionId: null,
          sprintId: null,
          storyPoints: null,
          blockedReason:
            status === "blocked" ? blockedReason.trim() || null : null,
          approvalId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        onCreated(optimistic);
        onClose();
      } catch {
        // keep modal open on error — user can retry
      }
    });
  }

  const agentName = agents.find((a) => a.id === agentId)?.name;
  const teamName = teams.find((t) => t.id === teamId)?.name;

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-[3px] transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Centered modal wrapper */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          role="dialog"
          aria-modal
          aria-label="New task"
          className={cn(
            "pointer-events-auto w-full max-w-[560px] min-h-[260px]",
            "flex flex-col rounded-xl bg-card border border-border",
            "shadow-2xl shadow-black/70",
            "transition-all duration-200",
            visible
              ? "scale-100 opacity-100"
              : "scale-[0.97] opacity-0",
          )}
          style={{ transitionTimingFunction: "cubic-bezier(0.2,0,0,1)" }}
        >
          {/* Header */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
            <span className="font-mono text-[10px] text-muted-foreground/40 tracking-wide">
              Tasks › New
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex size-6 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-colors"
              aria-label="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 pt-4 pb-3 flex-1">
            {/* Title */}
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Issue title"
              className="w-full bg-transparent text-[20px] font-semibold text-foreground placeholder:text-muted-foreground/25 focus:outline-none leading-tight"
            />

            {/* Description with Write/Preview tabs */}
            <div className="mt-3">
              <div className="mb-1.5 flex items-center gap-0">
                <button
                  type="button"
                  onClick={() => setDescMode("write")}
                  className={cn(
                    "px-2 py-0.5 font-mono text-[11px] transition-colors rounded-sm",
                    descMode === "write"
                      ? "text-foreground/70 bg-white/[0.06]"
                      : "text-muted-foreground/30 hover:text-muted-foreground/60",
                  )}
                >
                  Write
                </button>
                <span className="text-muted-foreground/20 text-[11px]">|</span>
                <button
                  type="button"
                  onClick={() => setDescMode("preview")}
                  className={cn(
                    "px-2 py-0.5 font-mono text-[11px] transition-colors rounded-sm",
                    descMode === "preview"
                      ? "text-foreground/70 bg-white/[0.06]"
                      : "text-muted-foreground/30 hover:text-muted-foreground/60",
                  )}
                >
                  Preview
                </button>
              </div>
              {descMode === "write" ? (
                <textarea
                  ref={textareaRef}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    autoGrow(e.target);
                  }}
                  placeholder="Description... (markdown supported)"
                  rows={3}
                  className="w-full bg-transparent font-mono text-[12.5px] text-foreground/70 placeholder:text-muted-foreground/25 focus:outline-none resize-none min-h-[72px] leading-relaxed"
                />
              ) : (
                <div className="min-h-[72px] text-[13px]">
                  {description.trim() ? (
                    <div className="prose prose-invert prose-sm max-w-none text-[13px]">
                      <ReactMarkdown>{description}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/25 italic text-[13px]">
                      Nothing to preview.
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <TaskCreateModalMetaBarPart
            metaBarRef={metaBarRef}
            status={status}
            setStatus={setStatus}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
            agentId={agentId}
            setAgentId={setAgentId}
            agents={agents}
            agentName={agentName}
            teamId={teamId}
            setTeamId={setTeamId}
            teams={teams}
            teamName={teamName}
            blockedReason={blockedReason}
            setBlockedReason={setBlockedReason}
            titleTrimmedEmpty={!title.trim()}
            isPending={isPending}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </>
  );
}
