"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { User, Users, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/tasks/task-tree";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In progress",
  blocked: "Blocked",
  in_review: "In review",
  done: "Done",
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  backlog: "bg-muted-foreground/30",
  todo: "bg-indigo-400",
  in_progress: "bg-primary",
  blocked: "bg-destructive",
  in_review: "bg-amber-400",
  done: "bg-emerald-500",
};

export const STATUS_OPTIONS: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "blocked",
  "in_review",
  "done",
];

const chipCls =
  "flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] transition-colors hover:bg-white/[0.06] border border-transparent hover:border-border cursor-pointer select-none";

const dropdownCls =
  "absolute z-10 mt-1 w-[200px] rounded-md border border-white/[0.10] bg-popover py-1 shadow-xl shadow-black/50";

const dropdownItemCls =
  "flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] hover:bg-white/[0.06] cursor-pointer transition-colors";

export type TaskCreateModalMetaBarPartProps = {
  metaBarRef: RefObject<HTMLDivElement | null>;
  status: TaskStatus;
  setStatus: (s: TaskStatus) => void;
  openDropdown: "status" | "agent" | "team" | null;
  setOpenDropdown: Dispatch<SetStateAction<"status" | "agent" | "team" | null>>;
  agentId: string;
  setAgentId: (id: string) => void;
  agents: { id: string; name: string }[];
  agentName: string | undefined;
  teamId: string;
  setTeamId: (id: string) => void;
  teams: { id: string; name: string }[];
  teamName: string | undefined;
  blockedReason: string;
  setBlockedReason: (v: string) => void;
  titleTrimmedEmpty: boolean;
  isPending: boolean;
  onSubmit: () => void;
};

export function TaskCreateModalMetaBarPart({
  metaBarRef,
  status,
  setStatus,
  openDropdown,
  setOpenDropdown,
  agentId,
  setAgentId,
  agents,
  agentName,
  teamId,
  setTeamId,
  teams,
  teamName,
  blockedReason,
  setBlockedReason,
  titleTrimmedEmpty,
  isPending,
  onSubmit,
}: TaskCreateModalMetaBarPartProps) {
  return (
    <div
      ref={metaBarRef}
      className="border-t border-white/[0.06] px-4 py-3 flex items-center gap-2"
    >
      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setOpenDropdown((d) => (d === "status" ? null : "status"))
          }
          className={chipCls}
        >
          <span
            className={cn("size-1.5 rounded-full", STATUS_DOT[status])}
          />
          <span className="text-foreground/70">{STATUS_LABEL[status]}</span>
        </button>
        {openDropdown === "status" && (
          <div className={cn(dropdownCls, "bottom-full mb-1")}>
            {STATUS_OPTIONS.map((s) => (
              <div
                key={s}
                className={cn(
                  dropdownItemCls,
                  s === status ? "text-foreground" : "text-foreground/60",
                )}
                onClick={() => {
                  setStatus(s);
                  setOpenDropdown(null);
                }}
              >
                <span
                  className={cn("size-1.5 rounded-full", STATUS_DOT[s])}
                />
                <span>{STATUS_LABEL[s]}</span>
                {s === status && (
                  <Check className="ml-auto size-3 text-primary" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setOpenDropdown((d) => (d === "agent" ? null : "agent"))
          }
          className={chipCls}
        >
          <User className="size-3 text-muted-foreground/50" />
          <span className="text-muted-foreground/50">
            {agentName ?? "Assignee"}
          </span>
        </button>
        {openDropdown === "agent" && (
          <div className={cn(dropdownCls, "bottom-full mb-1")}>
            <div
              className={cn(
                dropdownItemCls,
                !agentId ? "text-foreground" : "text-foreground/60",
              )}
              onClick={() => {
                setAgentId("");
                setOpenDropdown(null);
              }}
            >
              <User className="size-3.5 text-muted-foreground/40" />
              <span>Unassigned</span>
              {!agentId && (
                <Check className="ml-auto size-3 text-primary" />
              )}
            </div>
            {agents.map((a) => (
              <div
                key={a.id}
                className={cn(
                  dropdownItemCls,
                  a.id === agentId
                    ? "text-foreground"
                    : "text-foreground/60",
                )}
                onClick={() => {
                  setAgentId(a.id);
                  setOpenDropdown(null);
                }}
              >
                <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] bg-white/[0.08] font-mono text-[8px] text-muted-foreground/70">
                  {a.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate">{a.name}</span>
                {a.id === agentId && (
                  <Check className="ml-auto size-3 text-primary" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setOpenDropdown((d) => (d === "team" ? null : "team"))
          }
          className={chipCls}
        >
          <Users className="size-3 text-muted-foreground/50" />
          <span className="text-muted-foreground/50">
            {teamName ?? "Team"}
          </span>
        </button>
        {openDropdown === "team" && (
          <div className={cn(dropdownCls, "bottom-full mb-1")}>
            <div
              className={cn(
                dropdownItemCls,
                !teamId ? "text-foreground" : "text-foreground/60",
              )}
              onClick={() => {
                setTeamId("");
                setOpenDropdown(null);
              }}
            >
              <Users className="size-3.5 text-muted-foreground/40" />
              <span>No team</span>
              {!teamId && (
                <Check className="ml-auto size-3 text-primary" />
              )}
            </div>
            {teams.map((t) => (
              <div
                key={t.id}
                className={cn(
                  dropdownItemCls,
                  t.id === teamId
                    ? "text-foreground"
                    : "text-foreground/60",
                )}
                onClick={() => {
                  setTeamId(t.id);
                  setOpenDropdown(null);
                }}
              >
                <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] bg-white/[0.08] font-mono text-[8px] text-muted-foreground/70">
                  {t.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate">{t.name}</span>
                {t.id === teamId && (
                  <Check className="ml-auto size-3 text-primary" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {status === "blocked" && (
        <input
          placeholder="Blocked reason..."
          value={blockedReason}
          onChange={(e) => setBlockedReason(e.target.value)}
          className="flex-1 bg-transparent text-[12px] text-destructive/80 placeholder:text-destructive/40 focus:outline-none"
        />
      )}

      <div className="ml-auto">
        <button
          type="button"
          onClick={onSubmit}
          disabled={titleTrimmedEmpty || isPending}
          className="flex h-7 items-center gap-1.5 rounded-md bg-primary/10 border border-primary/25 px-3 text-[12px] font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
        >
          {isPending && (
            <span className="size-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          )}
          Create task
        </button>
      </div>
    </div>
  );
}
