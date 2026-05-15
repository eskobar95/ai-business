"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createSprint } from "@/lib/sprints/actions";
import { PrimaryButton } from "@/components/ui/primary-button";
import { cn } from "@/lib/utils";

export function CreateSprintForm({ missionId }: { missionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pending, start] = useTransition();

  function reset() {
    setName("");
    setGoal("");
    setStartDate("");
    setEndDate("");
    setOpen(false);
  }

  function submit() {
    const nm = name.trim();
    if (!nm) {
      toast.error("Sprint name is required.");
      return;
    }
    start(async () => {
      const result = await createSprint(missionId, {
        name: nm,
        goal: goal.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Sprint created.");
      reset();
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-dashed border-white/[0.15] px-4 py-2.5 text-[13px] text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground"
      >
        <span className="text-[15px] leading-none">+</span>
        New sprint
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-white/[0.15] bg-white/[0.02] p-4">
      <p className="section-label mb-3">New sprint</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          autoFocus
          placeholder="Sprint name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-primary/50"
        />
        <textarea
          placeholder="Goal (optional)"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={1}
          className="resize-none rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-primary/50"
        />
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">
            Start date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">
            End date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-primary/50"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground",
            pending && "cursor-not-allowed opacity-50",
          )}
        >
          Cancel
        </button>
        <PrimaryButton
          type="button"
          size="sm"
          disabled={!name.trim() || pending}
          loading={pending}
          onClick={submit}
        >
          Add sprint
        </PrimaryButton>
      </div>
    </div>
  );
}
