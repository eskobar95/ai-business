"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateTaskPrLink } from "@/lib/tasks/actions";
import { TaskPrBadge } from "@/components/tasks/task-pr-badge";

type Props = {
  taskId: string;
  initialGithubPrNumber: number | null;
  initialGithubRepoInstallationId: string | null;
  githubPrStatus: string | null;
  installations: { id: string; label: string }[];
};

export function TaskPrLinkForm({
  taskId,
  initialGithubPrNumber,
  initialGithubRepoInstallationId,
  githubPrStatus,
  installations,
}: Props) {
  const router = useRouter();
  const [prNumber, setPrNumber] = useState(
    initialGithubPrNumber != null ? String(initialGithubPrNumber) : "",
  );
  const [installationId, setInstallationId] = useState(initialGithubRepoInstallationId ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPrNumber(initialGithubPrNumber != null ? String(initialGithubPrNumber) : "");
    setInstallationId(initialGithubRepoInstallationId ?? "");
  }, [taskId, initialGithubPrNumber, initialGithubRepoInstallationId]);

  function submit() {
    const trimmed = prNumber.trim();
    const has = trimmed.length > 0 || installationId.length > 0;
    const parsed = trimmed.length > 0 ? Number.parseInt(trimmed, 10) : null;

    startTransition(async () => {
      try {
        if (!has) {
          await updateTaskPrLink(taskId, {
            githubPrNumber: null,
            githubRepoInstallationId: null,
          });
        } else {
          if (parsed == null || Number.isNaN(parsed)) {
            toast.error("Enter a valid PR number");
            return;
          }
          if (!installationId) {
            toast.error("Select a repository");
            return;
          }
          await updateTaskPrLink(taskId, {
            githubPrNumber: parsed,
            githubRepoInstallationId: installationId,
          });
        }
        toast.success("Pull request link saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save PR link");
      }
    });
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="sr-only">Repository</span>
        <select
          value={installationId}
          onChange={(e) => setInstallationId(e.target.value)}
          disabled={pending || installations.length === 0}
          className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[12px] text-foreground/80 outline-none focus:border-white/[0.16] disabled:opacity-50"
        >
          <option value="">Select repository…</option>
          {installations.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
      </label>
      {installations.length === 0 && (
        <p className="text-[11px] text-muted-foreground/40">Connect GitHub in workspace settings.</p>
      )}
      <label className="block">
        <span className="sr-only">PR number</span>
        <input
          type="number"
          min={1}
          placeholder="1234"
          value={prNumber}
          onChange={(e) => setPrNumber(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[12px] text-foreground/80 outline-none focus:border-white/[0.16] disabled:opacity-50"
        />
      </label>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="w-full rounded-md border border-white/[0.1] bg-white/[0.06] py-1.5 text-[12px] font-medium text-foreground/75 transition-colors hover:bg-white/[0.09] disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {githubPrStatus ? (
        <div className="pt-1">
          <TaskPrBadge status={githubPrStatus} />
        </div>
      ) : null}
    </div>
  );
}
