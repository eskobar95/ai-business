"use client";

import { Check, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskGateStatusProps = {
  taskStatus: string;
  dependencyTask: { status: string; title: string } | null;
  prMergedToIntegration: boolean;
  githubPrStatus: string | null;
  githubPrNumber: number | null;
  integrationBranch: string | null;
};

function statusWords(status: string): string {
  return status === "done" ? "done" : status.replaceAll("_", " ");
}

export function TaskGateStatus(props: TaskGateStatusProps) {
  const { dependencyTask, prMergedToIntegration, githubPrNumber, integrationBranch, githubPrStatus } = props;

  if (props.taskStatus !== "todo" && props.taskStatus !== "backlog") return null;

  const hasGateSignal = dependencyTask != null || githubPrNumber != null;
  if (!hasGateSignal) return null;

  const depOk = !dependencyTask || dependencyTask.status === "done";
  const prOk = !githubPrNumber || prMergedToIntegration;
  const gatesReady = depOk && prOk;

  const branchLabel = integrationBranch ?? "integration branch";

  const depStatusLabel = dependencyTask ? statusWords(dependencyTask.status) : "";

  return (
    <div className="space-y-2 text-[12px]">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/25">Gate status</p>
      {dependencyTask ? (
        <div
          className={cn(
            "flex items-center gap-2",
            depOk ? "text-emerald-500/90" : dependencyTask.status === "in_progress" ? "text-amber-400/90" : "text-muted-foreground/55",
          )}
        >
          <span className="sr-only">
            {depOk
              ? "Dependency satisfied."
              : `Dependency not complete: ${depStatusLabel}, ${dependencyTask.title}.`}
          </span>
          {depOk ? (
            <Check className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <Timer className="size-3.5 shrink-0" aria-hidden />
          )}
          <span aria-hidden>
            Dependency: {depStatusLabel}
            <span className="text-muted-foreground/40"> — {dependencyTask.title}</span>
          </span>
        </div>
      ) : null}

      {githubPrNumber != null ? (
        <div className={cn("flex items-center gap-2", prOk ? "text-emerald-500/90" : "text-amber-400/90")}>
          <span className="sr-only">
            {prOk
              ? `Pull request ${githubPrNumber} merged to ${branchLabel}.`
              : `Pull request ${githubPrNumber} waiting for merge to ${branchLabel}${githubPrStatus ? `, status ${githubPrStatus}` : ""}.`}
          </span>
          {prOk ? (
            <Check className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <Timer className="size-3.5 shrink-0" aria-hidden />
          )}
          <span aria-hidden>
            PR #{githubPrNumber}:{" "}
            {prOk
              ? `merged to ${branchLabel}`
              : `waiting for merge to ${branchLabel}${githubPrStatus ? ` (${githubPrStatus})` : ""}`}
          </span>
        </div>
      ) : null}

      <p className={cn("pt-0.5", gatesReady ? "text-emerald-500/80" : "text-muted-foreground/60")}>
        <span className="sr-only">{gatesReady ? "All gates satisfied. " : "Gates not satisfied. "}</span>
        <span aria-hidden>{gatesReady ? "→ Gates ready — agent will start when scheduled" : "→ Gates not ready"}</span>
      </p>
    </div>
  );
}
