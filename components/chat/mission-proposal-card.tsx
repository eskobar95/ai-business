"use client";

import { ArrowRight, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ParsedMissionProposal } from "@/lib/chat/parse-mission-proposals";
import { createMission } from "@/lib/missions/actions";
import { cn } from "@/lib/utils";

function excerpt(text: string, max: number): string {
  const t = text.trim();
  if (!t) return "—";
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function MissionProposalCard({
  proposal,
  businessId,
  className,
}: {
  proposal: ParsedMissionProposal;
  businessId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nameOk = proposal.name.trim().length >= 3;

  function handleCreate() {
    setError(null);
    if (!nameOk) {
      setError("Mission title must be at least 3 characters.");
      return;
    }
    start(async () => {
      try {
        const { id } = await createMission({
          businessId,
          name: proposal.name.trim(),
          prd: proposal.goal.trim(),
          validationContract: proposal.validationContract.trim(),
          projectType: proposal.projectType,
          status: "draft",
        });
        toast.success("Mission created");
        router.push(
          `/dashboard/missions/${id}?businessId=${encodeURIComponent(businessId)}`,
        );
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not create mission";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] to-transparent p-3 shadow-[0_0_0_1px_rgba(168,235,18,0.06)]",
        className,
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20">
          <Rocket className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            Proposed mission
          </p>
          <p className="text-sm font-semibold leading-snug text-foreground">
            {proposal.name.trim() || "Untitled"}
          </p>
        </div>
      </div>

      <dl className="mb-3 space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50">
            Goal / PRD
          </dt>
          <dd className="text-foreground/85">{excerpt(proposal.goal, 280)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50">
            Validation contract
          </dt>
          <dd className="text-foreground/85">{excerpt(proposal.validationContract, 220)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50">
            Project type
          </dt>
          <dd className="font-mono text-[11px] text-primary/90">{proposal.projectType}</dd>
        </div>
      </dl>

      {error ? (
        <p className="mb-2 text-[11px] text-destructive/90" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        size="sm"
        className="w-full gap-1.5 font-medium"
        disabled={pending || !nameOk}
        onClick={handleCreate}
      >
        {pending ? "Creating…" : "Create mission"}
        <ArrowRight className="size-3.5 opacity-80" aria-hidden />
      </Button>
    </div>
  );
}
