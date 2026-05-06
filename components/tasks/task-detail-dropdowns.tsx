"use client";

import { useState, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { PriorityIcon } from "@/components/tasks/task-detail-priority-icon";
import {
  PRIORITY_CONFIG,
  PRIORITIES,
  STATUSES,
  STATUS_DOT,
  STATUS_LABEL,
  type Priority,
} from "@/lib/tasks/task-detail-display";
import type { TaskStatus } from "@/lib/tasks/task-tree";

export function StatusDropdown({
  value,
  onChange,
  disabled,
}: {
  value: TaskStatus;
  onChange: (s: TaskStatus) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/[0.05] transition-colors -mx-2 disabled:opacity-50 w-full"
      >
        <span className={cn("size-2 rounded-full shrink-0", STATUS_DOT[value])} />
        <span className="text-[13px] text-foreground/70">{STATUS_LABEL[value]}</span>
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground/30 ml-auto transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="dropdown-animate absolute left-0 top-full mt-1 z-50 w-44 rounded-lg border border-white/[0.10] bg-popover shadow-2xl py-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              title={
                s === "todo"
                  ? "Agent starts automatically when gates are green."
                  : undefined
              }
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] text-foreground/70 hover:bg-white/[0.06] transition-colors"
            >
              <span className={cn("size-2 rounded-full shrink-0", STATUS_DOT[s])} />
              {STATUS_LABEL[s]}
              {s === value && <Check className="ml-auto size-3 text-primary/70" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PriorityDropdown({
  value,
  onChange,
  disabled,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const cfg = PRIORITY_CONFIG[value] ?? PRIORITY_CONFIG.none;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/[0.05] transition-colors -mx-2 disabled:opacity-50 w-full"
      >
        <PriorityIcon priority={value} className={cfg.color} />
        <span className={cn("text-[13px]", cfg.color)}>{cfg.label}</span>
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground/30 ml-auto transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="dropdown-animate absolute left-0 top-full mt-1 z-50 w-44 rounded-lg border border-white/[0.10] bg-popover shadow-2xl py-1">
          {PRIORITIES.map((p) => {
            const c = PRIORITY_CONFIG[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] hover:bg-white/[0.06] transition-colors"
              >
                <PriorityIcon priority={p} className={c.color} />
                <span className={cn(c.color)}>{c.label}</span>
                {p === value && <Check className="ml-auto size-3 text-primary/60" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AssigneeDropdown({
  value,
  agents,
  onChange,
  disabled,
}: {
  value: string | null;
  agents: { id: string; name: string }[];
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const current = agents.find((a) => a.id === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/[0.05] transition-colors -mx-2 disabled:opacity-50 w-full"
      >
        {current ? (
          <>
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-white/[0.08] font-mono text-[9px] text-foreground/50 shrink-0">
              {current.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="text-[13px] text-foreground/70 truncate">{current.name}</span>
          </>
        ) : (
          <span className="text-[13px] text-muted-foreground/35">Unassigned</span>
        )}
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground/30 ml-auto shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="dropdown-animate absolute left-0 top-full mt-1 z-50 w-52 rounded-lg border border-white/[0.10] bg-popover shadow-2xl py-1 max-h-52 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] text-foreground/50 hover:bg-white/[0.06] transition-colors"
          >
            <span className="inline-flex size-5 items-center justify-center rounded-full border border-white/[0.10] text-muted-foreground/30">
              –
            </span>
            Unassigned
            {!value && <Check className="ml-auto size-3 text-primary/70" />}
          </button>
          {agents.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onChange(a.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] text-foreground/70 hover:bg-white/[0.06] transition-colors"
            >
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-white/[0.08] font-mono text-[9px] text-foreground/50 shrink-0">
                {a.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="truncate">{a.name}</span>
              {a.id === value && <Check className="ml-auto size-3 text-primary/70" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Team picker — currently unused by the shell but kept colocated with other metadata dropdowns. */
export function TeamDropdown({
  value,
  teams,
  onChange,
  disabled,
}: {
  value: string | null;
  teams: { id: string; name: string }[];
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const current = teams.find((t) => t.id === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/[0.05] transition-colors -mx-2 disabled:opacity-50 w-full"
      >
        {current ? (
          <span className="text-[13px] text-foreground/70 truncate">{current.name}</span>
        ) : (
          <span className="text-[13px] text-muted-foreground/35">No team</span>
        )}
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground/30 ml-auto shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="dropdown-animate absolute left-0 top-full mt-1 z-50 w-52 rounded-lg border border-white/[0.10] bg-popover shadow-2xl py-1 max-h-52 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-[12.5px] text-foreground/50 hover:bg-white/[0.06] transition-colors"
          >
            No team
            {!value && <Check className="ml-auto size-3 text-primary/70" />}
          </button>
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onChange(t.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-[12.5px] text-foreground/70 hover:bg-white/[0.06] transition-colors"
            >
              <span className="truncate">{t.name}</span>
              {t.id === value && <Check className="ml-auto size-3 text-primary/70" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
