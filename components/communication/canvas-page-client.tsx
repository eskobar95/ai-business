"use client";

import { CanvasV2 } from "@/components/communication/canvas-v2";
import { CommunicationEdgesSection } from "@/components/communication/communication-edges-section";
import { cn } from "@/lib/utils";
import type { AgentCommunicationCanvasRow } from "@/lib/agents/communication-canvas";
import type { CommunicationEdgeRow } from "@/lib/communication/edge-store";
import { useMemo, useState } from "react";

function countAttentionMetrics(
  agents: AgentCommunicationCanvasRow[],
  edges: CommunicationEdgeRow[],
): { orphanEdges: number; ackEdges: number; total: number } {
  const slugs = new Set(
    agents.map((a) => a.slug).filter((s): s is string => typeof s === "string" && s.length > 0),
  );
  let orphanEdges = 0;
  let ackEdges = 0;
  for (const e of edges) {
    if (!slugs.has(e.fromRole) || !slugs.has(e.toRole)) orphanEdges += 1;
    if (e.requiresHumanAck) ackEdges += 1;
  }
  return {
    orphanEdges,
    ackEdges,
    total: orphanEdges + ackEdges,
  };
}

export function CommunicationPageClient({
  businessId,
  agents,
  edges,
}: {
  businessId: string;
  agents: AgentCommunicationCanvasRow[];
  edges: CommunicationEdgeRow[];
}) {
  const [view, setView] = useState<"graph" | "list">("graph");
  const [connectMode, setConnectMode] = useState(false);

  const attention = useMemo(() => countAttentionMetrics(agents, edges), [agents, edges]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Communication views"
            className="border-border bg-muted/40 inline-flex rounded-lg border p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "graph"}
              data-testid="communication-view-graph"
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === "graph" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground",
              )}
              onClick={() => setView("graph")}
            >
              Graph
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "list"}
              data-testid="communication-view-list"
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === "list" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground",
              )}
              onClick={() => setView("list")}
            >
              List
            </button>
          </div>
          <button
            type="button"
            disabled={view !== "graph"}
            data-testid="communication-connect-toggle"
            className={cn(
              "border-border bg-background text-foreground hover:bg-muted/50 rounded-md border px-3 py-1.5 text-xs font-semibold tracking-tight",
              connectMode && "border-primary bg-primary/10 text-primary ring-primary/30 ring-2 ring-offset-1",
              view !== "graph" && "opacity-40",
            )}
            onClick={() => {
              const next = !connectMode;
              setConnectMode(next);
            }}
          >
            + Connect agents
          </button>
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-4 font-mono text-[11px]">
          <span data-testid="communication-stat-agents">{agents.length} agents</span>
          <span data-testid="communication-stat-edges">{edges.length} edges</span>
          <span data-testid="communication-stat-violations" title="Orphan endpoints + ACK-required edges">
            {attention.total} attention
          </span>
        </div>
      </div>

      {view === "graph" ?
        <CanvasV2
          businessId={businessId}
          agents={agents}
          edges={edges}
          connectMode={connectMode}
          onConnectModeChange={(on) => setConnectMode(on)}
        />
      : <CommunicationEdgesSection businessId={businessId} initialEdges={edges} />}
    </div>
  );
}
