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

export function TaskGateStatus(props: TaskGateStatusProps) {
  const { dependencyTask, prMergedToIntegration, githubPrNumber, integrationBranch, githubPrStatus } = props;

  if (props.taskStatus !== "todo" && props.taskStatus !== "backlog") return null;

  const hasGateSignal = dependencyTask != null || githubPrNumber != null;
  if (!hasGateSignal) return null;

  const depOk = !dependencyTask || dependencyTask.status === "done";
  const prOk = !githubPrNumber || prMergedToIntegration;
  const gatesReady = depOk && prOk;

  const branchLabel = integrationBranch ?? "integration branch";

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
          {depOk ? <Check className="size-3.5 shrink-0" /> : <Timer className="size-3.5 shrink-0" />}
          <span>
            Dependency: {dependencyTask.status === "done" ? "done" : dependencyTask.status.replace("_", " ")}
            <span className="text-muted-foreground/40"> — {dependencyTask.title}</span>
          </span>
        </div>
      ) : null}

      {githubPrNumber != null ? (
        <div className={cn("flex items-center gap-2", prOk ? "text-emerald-500/90" : "text-amber-400/90")}>
          {prOk ? <Check className="size-3.5 shrink-0" /> : <Timer className="size-3.5 shrink-0" />}
          <span>
            PR #{githubPrNumber}:{" "}
            {prOk
              ? `merged to ${branchLabel}`
              : `waiting for merge to ${branchLabel}${githubPrStatus ? ` (${githubPrStatus})` : ""}`}
          </span>
        </div>
      ) : null}

      <p className={cn("pt-0.5", gatesReady ? "text-emerald-500/80" : "text-muted-foreground/60")}>
        {gatesReady ? "→ Gates ready — agent will start when scheduled" : "→ Gates not ready"}
      </p>
    </div>
  );
}
