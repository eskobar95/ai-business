"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { updateSelectedRepos } from "@/lib/github/actions";

export function GithubRepoSelector({
  businessId,
  allRepos,
  initialSelected,
}: {
  businessId: string;
  allRepos: string[];
  initialSelected: string[] | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelected ?? allRepos),
  );
  const [pending, startTransition] = useTransition();

  function toggle(repo: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(repo)) {
        next.delete(repo);
      } else {
        next.add(repo);
      }
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(allRepos));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function onSave() {
    startTransition(async () => {
      const result = await updateSelectedRepos(businessId, Array.from(selected));
      if (result.success) {
        toast.success("Repository selection saved.");
      } else {
        toast.error(result.error ?? "Could not save selection.");
      }
    });
  }

  const allSelected = selected.size === allRepos.length;
  const noneSelected = selected.size === 0;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Select repositories agents can work with.{" "}
          {noneSelected ? (
            <span className="text-amber-500">No explicit selection — agents will use all available repositories.</span>
          ) : allSelected ? (
            <span>All {allRepos.length} repos selected.</span>
          ) : (
            <span>{selected.size} of {allRepos.length} selected.</span>
          )}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            disabled={allSelected || pending}
            className="text-[11px] text-primary hover:underline disabled:opacity-30"
          >
            All
          </button>
          <span className="text-muted-foreground text-[11px]">·</span>
          <button
            type="button"
            onClick={selectNone}
            disabled={noneSelected || pending}
            className="text-[11px] text-primary hover:underline disabled:opacity-30"
          >
            None
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-white/[0.02] p-1">
        {allRepos.map((repo) => (
          <label
            key={repo}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-white/[0.04] transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.has(repo)}
              onChange={() => toggle(repo)}
              disabled={pending}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            <span className="font-mono text-[12px] text-foreground/80">{repo}</span>
          </label>
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-4 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {pending ? "Saving…" : "Save selection"}
        </button>
      </div>
    </div>
  );
}
