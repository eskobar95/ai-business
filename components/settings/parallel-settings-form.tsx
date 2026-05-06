"use client";

import { CircleHelp } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { PrimaryButton } from "@/components/ui/primary-button";
import { updateBusinessParallelSettings } from "@/lib/settings/branch-actions";

function FieldHint({ text }: { text: string }) {
  return (
    <span
      className="inline-flex cursor-help text-muted-foreground/40"
      title={text}
      aria-label={text}
    >
      <CircleHelp className="size-3.5" />
    </span>
  );
}

export function ParallelSettingsForm({
  businessId,
  initialMaxParallelRuns,
}: {
  businessId: string;
  initialMaxParallelRuns: number | null;
}) {
  const capEnabled = initialMaxParallelRuns !== null;
  const [enabled, setEnabled] = useState(capEnabled);
  const [maxRuns, setMaxRuns] = useState(
    initialMaxParallelRuns != null ? String(initialMaxParallelRuns) : "1",
  );
  const [pending, startSave] = useTransition();

  useEffect(() => {
    const on = initialMaxParallelRuns !== null;
    setEnabled(on);
    setMaxRuns(initialMaxParallelRuns != null ? String(initialMaxParallelRuns) : "1");
  }, [initialMaxParallelRuns]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = enabled ? Number.parseInt(maxRuns, 10) : null;
    if (enabled && (Number.isNaN(value) || value! < 1)) {
      toast.error("Max parallel runs must be at least 1.");
      return;
    }
    startSave(async () => {
      try {
        await updateBusinessParallelSettings(businessId, {
          maxParallelRuns: enabled ? value! : null,
        });
        toast.success("Parallel settings saved.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save parallel settings.");
      }
    });
  }

  return (
    <section className="flex max-w-md flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              id="parallelCapEnabled"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={pending}
              className="size-4 rounded border-border bg-white/[0.04]"
            />
            <label htmlFor="parallelCapEnabled" className="label-upper cursor-pointer">
              Aktiver parallel-loft
            </label>
            <FieldHint text="Gælder for hele dit workspace. Slået fra = ubegrænset (kun per-agent mutex aktiv)." />
          </div>
        </div>

        {enabled ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="maxParallelRuns" className="label-upper">
              Max parallelle agent-runs
            </label>
            <input
              id="maxParallelRuns"
              name="maxParallelRuns"
              type="number"
              min={1}
              step={1}
              value={maxRuns}
              onChange={(e) => setMaxRuns(e.target.value)}
              className="h-9 max-w-[200px] rounded-md border border-border bg-white/[0.04] px-3 text-[13px] text-foreground/80 focus:border-white/[0.16] focus:outline-none transition-colors disabled:opacity-50"
              disabled={pending}
            />
          </div>
        ) : null}

        <div>
          <PrimaryButton type="submit" disabled={pending} loading={pending}>
            {pending ? "Saving…" : "Save parallel settings"}
          </PrimaryButton>
        </div>
      </form>
    </section>
  );
}
