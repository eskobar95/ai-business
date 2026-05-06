"use client";

import { forwardRef } from "react";

import { AgentRosterAvatar } from "@/components/agents/agent-roster-avatar";
import { cn } from "@/lib/utils";

import type { CommunicationStream } from "@/lib/agents/communication-canvas";
import type { AgentCommunicationCanvasRow } from "@/lib/agents/communication-canvas";

function tierLabel(tier: number | null): string {
  if (tier === 1) return "Lead";
  if (tier === 2) return "Senior";
  if (tier === 3) return "Specialist";
  return "—";
}

function tierStyles(tier: number | null): string {
  if (tier === 1) {
    return "border-amber-500/35 bg-amber-500/15 text-amber-600 dark:text-amber-400";
  }
  if (tier === 2) {
    return "border-sky-500/35 bg-sky-500/15 text-sky-600 dark:text-sky-400";
  }
  return "border-border bg-white/[0.04] text-muted-foreground";
}

export type CanvasNodeProps = {
  agent: AgentCommunicationCanvasRow;
  stream: CommunicationStream;
  connectMode: boolean;
  isConnectSource: boolean;
  isHovered: boolean;
  onClick: () => void;
};

export const CanvasNode = forwardRef<HTMLDivElement, CanvasNodeProps>(function CanvasNode(
  { agent, stream, connectMode, isConnectSource, isHovered, onClick }: CanvasNodeProps,
  ref,
) {
  const slug = agent.slug ?? "—";
  const showStream = stream !== "other";

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      data-testid={`canvas-node-${slug}`}
      data-agent-slug={agent.slug ?? ""}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "border-border bg-card/50 flex w-full max-w-[260px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-left shadow-xs transition-all",
        connectMode && "ring-muted-foreground/30 ring-2 ring-offset-2 ring-offset-background",
        isConnectSource && "ring-primary ring-2 ring-offset-2 ring-offset-background",
        isHovered && !isConnectSource && connectMode && "bg-card/80 border-primary/40",
      )}
    >
      <AgentRosterAvatar
        name={agent.name}
        avatarUrl={agent.avatarUrl}
        iconKey={agent.iconKey}
        sizeClasses="size-10 shrink-0 rounded-lg text-[12px]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-foreground truncate text-sm font-semibold leading-tight">{agent.name}</p>
          <span
            title="Agent status"
            className="bg-emerald-500/80 size-1.5 shrink-0 rounded-full"
            aria-label="Idle"
          />
        </div>
        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{agent.role}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-tight",
              tierStyles(agent.tier),
            )}
          >
            {tierLabel(agent.tier)}
          </span>
          {showStream ?
            <span className="text-muted-foreground rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">
              {stream === "product" ? "Product" : "Build"}
            </span>
          : null}
        </div>
        <p className="text-muted-foreground/70 mt-1 font-mono text-[10px] tracking-tight">{slug}</p>
      </div>
    </div>
  );
});
