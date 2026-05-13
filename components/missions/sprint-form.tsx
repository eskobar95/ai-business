"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createSprint } from "@/lib/sprints/actions";
import { PrimaryButton } from "@/components/ui/primary-button";

export function SprintFormInline({
  missionId,
  onDone,
}: {
  missionId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      try {
        await createSprint(missionId, { name: name.trim(), goal: goal.trim() || undefined });
        toast.success("Sprint added.");
        setName("");
        setGoal("");
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  const ok = name.trim().length > 0 && !pending;

  return (
    <div className="rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] p-4">
      <p className="section-label mb-3">New sprint</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          placeholder="Sprint name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none"
        />
        <input
          placeholder="Goal (optional)"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <PrimaryButton type="button" size="sm" disabled={!ok} loading={pending} onClick={submit}>
          Add sprint
        </PrimaryButton>
      </div>
    </div>
  );
}
