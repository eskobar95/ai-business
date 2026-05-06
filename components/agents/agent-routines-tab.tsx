"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createRoutine, deleteRoutine, updateRoutine } from "@/lib/routines/actions";
import type { RoutineRow } from "@/lib/routines/queries";
import { cn } from "@/lib/utils";

export function AgentRoutinesTab({
  businessId,
  agentId,
  initialRoutines,
}: {
  businessId: string;
  agentId: string;
  initialRoutines: RoutineRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    name: "",
    description: "",
    cronExpression: "0 8 * * *",
    humanSchedule: "Every day at 08:00",
    prompt: "",
    isActive: true,
  });

  function resetDraft(): void {
    setDraft({
      name: "",
      description: "",
      cronExpression: "0 8 * * *",
      humanSchedule: "Every day at 08:00",
      prompt: "",
      isActive: true,
    });
    setEditingId(null);
    setError(null);
  }

  function startEdit(r: RoutineRow): void {
    setEditingId(r.id);
    setFormOpen(true);
    setDraft({
      name: r.name,
      description: r.description ?? "",
      cronExpression: r.cronExpression,
      humanSchedule: r.humanSchedule,
      prompt: r.prompt,
      isActive: r.isActive,
    });
    setError(null);
  }

  function refreshFromServer(): void {
    router.refresh();
  }

  function submit(): void {
    setError(null);
    startTransition(async () => {
      if (editingId) {
        const res = await updateRoutine({
          id: editingId,
          name: draft.name,
          description: draft.description || undefined,
          cronExpression: draft.cronExpression,
          humanSchedule: draft.humanSchedule,
          prompt: draft.prompt,
          isActive: draft.isActive,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
      } else {
        const res = await createRoutine({
          businessId,
          agentId,
          name: draft.name,
          description: draft.description || undefined,
          cronExpression: draft.cronExpression,
          humanSchedule: draft.humanSchedule,
          prompt: draft.prompt,
          isActive: draft.isActive,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
      }
      setFormOpen(false);
      resetDraft();
      refreshFromServer();
    });
  }

  function toggleActive(r: RoutineRow): void {
    startTransition(async () => {
      const res = await updateRoutine({ id: r.id, isActive: !r.isActive });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      refreshFromServer();
    });
  }

  function remove(id: string): void {
    if (!window.confirm("Delete this routine?")) return;
    startTransition(async () => {
      const res = await deleteRoutine(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      refreshFromServer();
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-[12px] text-muted-foreground">
        Scheduled recurring prompts for this agent. Cron uses five fields:{" "}
        <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px]">minute hour day month weekday</code>{" "}
        (example: <span className="font-mono text-[11px]">0 8 * * *</span> — daily at 08:00).{" "}
        {/* TODO: Scheduler will invoke POST /agent/spawn when next_run_at is due (post-MVP). */}
      </p>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="section-label">Routines</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
          disabled={pending}
          onClick={() => {
            resetDraft();
            setFormOpen(true);
          }}
        >
          Add routine
        </Button>
      </div>

      {formOpen && (
        <div className="rounded-md border border-border bg-card p-4 space-y-3">
          <p className="text-[13px] font-medium text-foreground">{editingId ? "Edit routine" : "New routine"}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block space-y-1 text-[11px]">
              <span className="text-muted-foreground">Name</span>
              <input
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-[11px]">
              <span className="text-muted-foreground">Human schedule</span>
              <input
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                value={draft.humanSchedule}
                onChange={(e) => setDraft((d) => ({ ...d, humanSchedule: e.target.value }))}
              />
            </label>
          </div>
          <label className="block space-y-1 text-[11px]">
            <span className="text-muted-foreground">Description (optional)</span>
            <input
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </label>
          <label className="block space-y-1 text-[11px]">
            <span className="text-muted-foreground">Cron expression</span>
            <input
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              value={draft.cronExpression}
              onChange={(e) => setDraft((d) => ({ ...d, cronExpression: e.target.value }))}
            />
          </label>
          <label className="block space-y-1 text-[11px]">
            <span className="text-muted-foreground">Prompt</span>
            <textarea
              rows={4}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              value={draft.prompt}
              onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-foreground">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="cursor-pointer"
              disabled={pending}
              onClick={() => {
                setFormOpen(false);
                resetDraft();
              }}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" className="cursor-pointer" disabled={pending} onClick={submit}>
              {editingId ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      )}

      {initialRoutines.length === 0 && !formOpen ? (
        <p className="text-[13px] text-muted-foreground">No routines yet.</p>
      ) : (
        <ul className="space-y-2">
          {initialRoutines.map((r) => (
            <li
              key={r.id}
              className={cn(
                "flex flex-col gap-2 rounded-md border border-border bg-white/[0.02] px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">{r.name}</p>
                <p className="text-[11px] text-muted-foreground">{r.humanSchedule}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">{r.cronExpression}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    r.isActive ? "bg-primary/15 text-primary" : "bg-white/[0.06] text-muted-foreground",
                  )}
                >
                  {r.isActive ? "active" : "paused"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 cursor-pointer px-2 text-[11px]"
                  disabled={pending}
                  onClick={() => toggleActive(r)}
                >
                  Toggle
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 cursor-pointer px-2 text-[11px]"
                  disabled={pending}
                  onClick={() => startEdit(r)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 cursor-pointer px-2 text-[11px] text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => remove(r.id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
