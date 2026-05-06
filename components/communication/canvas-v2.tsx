"use client";

import type { CommunicationEdgeRow } from "@/lib/communication/edge-store";
import { EdgeForm } from "@/components/communication/edge-form";
import type { CanvasNodeRect } from "@/components/communication/canvas-edges-svg";
import { CanvasEdgesSvg } from "@/components/communication/canvas-edges-svg";
import type { CanvasNodeProps } from "@/components/communication/canvas-node";
import { CanvasNode } from "@/components/communication/canvas-node";
import { EdgeWizardDialog } from "@/components/communication/edge-wizard-dialog";
import { cn } from "@/lib/utils";
import { streamForAgentSlug, type CommunicationStream } from "@/lib/agents/communication-canvas";
import type { AgentCommunicationCanvasRow } from "@/lib/agents/communication-canvas";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

function sortAgentsForStream(rows: AgentCommunicationCanvasRow[]): AgentCommunicationCanvasRow[] {
  return [...rows].sort((a, b) => {
    const sa = (a.slug ?? a.name).toLowerCase();
    const sb = (b.slug ?? b.name).toLowerCase();
    return sa.localeCompare(sb);
  });
}

export type CanvasV2Props = {
  businessId: string;
  agents: AgentCommunicationCanvasRow[];
  edges: CommunicationEdgeRow[];
  connectMode: boolean;
  onConnectModeChange: (on: boolean) => void;
};

export function CanvasV2({
  businessId,
  agents,
  edges,
  connectMode,
  onConnectModeChange,
}: CanvasV2Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [, setResizeTick] = useState(0);

  const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 });
  const [positions, setPositions] = useState<Record<string, CanvasNodeRect>>({});
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [connectSourceSlug, setConnectSourceSlug] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPair, setWizardPair] = useState<{ from: string; to: string } | null>(null);

  const registerNode = useCallback((slugKey: string, el: HTMLDivElement | null) => {
    const m = nodeRefs.current;
    if (el) m.set(slugKey, el);
    else m.delete(slugKey);
  }, []);

  const agentsBySlug = useMemo(() => {
    const m = new Map<string, AgentCommunicationCanvasRow>();
    for (const a of agents) {
      if (a.slug) m.set(a.slug, a);
    }
    return m;
  }, [agents]);

  const { productAgents, buildAgents, otherAgents } = useMemo(() => {
    const product: AgentCommunicationCanvasRow[] = [];
    const build: AgentCommunicationCanvasRow[] = [];
    const other: AgentCommunicationCanvasRow[] = [];
    for (const a of agents) {
      const stream = streamForAgentSlug(a.slug);
      if (stream === "product") product.push(a);
      else if (stream === "build") build.push(a);
      else other.push(a);
    }
    return {
      productAgents: sortAgentsForStream(product),
      buildAgents: sortAgentsForStream(build),
      otherAgents: sortAgentsForStream(other),
    };
  }, [agents]);

  const refreshLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth;
    const h = Math.max(container.scrollHeight, container.clientHeight);
    setLayoutSize({ width: w, height: h });

    const rect = container.getBoundingClientRect();
    const next: Record<string, CanvasNodeRect> = {};

    nodeRefs.current.forEach((node, slugKey) => {
      const nr = node.getBoundingClientRect();
      next[slugKey] = {
        left: nr.left - rect.left + container.scrollLeft,
        top: nr.top - rect.top + container.scrollTop,
        width: nr.width,
        height: nr.height,
      };
    });

    setPositions(next);
  }, []);

  useLayoutEffect(() => {
    refreshLayout();
  }, [
    agents,
    edges,
    connectMode,
    selectedEdgeId,
    refreshLayout,
    productAgents,
    buildAgents,
    otherAgents,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setResizeTick((n) => n + 1);
      refreshLayout();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [refreshLayout]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (wizardOpen) return;
      setConnectSourceSlug(null);
      if (connectMode) onConnectModeChange(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [connectMode, onConnectModeChange, wizardOpen]);

  const slugKeyOf = useCallback((a: AgentCommunicationCanvasRow) => a.slug ?? `__row_${a.id}`, []);

  const renderColumn = (
    label: string,
    streamType: CommunicationStream,
    rows: AgentCommunicationCanvasRow[],
  ) => (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="text-muted-foreground border-border/60 border-b pb-2 text-[11px] font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div className="relative flex flex-col gap-3">
        {rows.map((a) => {
          const slugKey = slugKeyOf(a);
          const streamLabel: CommunicationStream = streamForAgentSlug(a.slug);
          const nodeStream: CanvasNodeProps["stream"] =
            streamType !== "other" ? streamType : streamLabel;

          return (
            <CanvasNode
              key={a.id}
              ref={(el) => registerNode(slugKey, el)}
              agent={a}
              stream={nodeStream}
              connectMode={connectMode}
              isConnectSource={connectSourceSlug === a.slug && !!a.slug}
              isHovered={
                !!(connectSourceSlug && connectSourceSlug !== a.slug && connectMode && a.slug)
              }
              onClick={() => {
                if (!connectMode) {
                  setSelectedEdgeId(null);
                  return;
                }
                const fromSlug = a.slug;
                if (!fromSlug) return;
                if (!connectSourceSlug) {
                  setConnectSourceSlug(fromSlug);
                  return;
                }
                if (connectSourceSlug === fromSlug) {
                  setConnectSourceSlug(null);
                  return;
                }
                setWizardPair({ from: connectSourceSlug, to: fromSlug });
                setWizardOpen(true);
                setConnectSourceSlug(null);
                onConnectModeChange(false);
              }}
            />
          );
        })}
      </div>
    </div>
  );

  const editingEdge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div ref={containerRef} className="border-border bg-muted/15 relative min-h-[420px] rounded-xl border">
        <div className="relative flex flex-row gap-6 p-5 md:gap-10">
          {renderColumn("Product stream", "product", productAgents)}
          {renderColumn("Build stream", "build", buildAgents)}
        </div>
        {otherAgents.length ?
          <div className="border-border/70 border-t p-5">
            {renderColumn("Other agents", "other", otherAgents)}
          </div>
        : null}
        <CanvasEdgesSvg
          width={layoutSize.width}
          height={
            layoutSize.height ||
            Math.max(containerRef.current?.scrollHeight ?? 0, containerRef.current?.clientHeight ?? 0)
          }
          positions={positions}
          edges={edges}
          selectedEdgeId={selectedEdgeId}
          onEdgeClick={(id) => {
            setSelectedEdgeId(id);
            setWizardOpen(false);
          }}
        />
      </div>

      {wizardPair ?
        <EdgeWizardDialog
          open={wizardOpen}
          businessId={businessId}
          fromRole={wizardPair.from}
          toRole={wizardPair.to}
          fromLabel={agentsBySlug.get(wizardPair.from)?.name ?? wizardPair.from}
          toLabel={agentsBySlug.get(wizardPair.to)?.name ?? wizardPair.to}
          onClose={() => {
            setWizardOpen(false);
            setWizardPair(null);
          }}
        />
      : null}

      {editingEdge ?
        <div
          className={cn("border-border bg-card/30 rounded-xl border p-4")}
          data-testid="canvas-edge-detail"
        >
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Selected edge ({editingEdge.fromRole} → {editingEdge.toRole})
          </p>
          <EdgeForm businessId={businessId} editingEdge={editingEdge} onCancelEdit={() => setSelectedEdgeId(null)} />
        </div>
      : null}

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Click an arrow to edit policy attributes. Enable &ldquo;Connect agents&rdquo; mode, choose a
        source agent, then a target to open the edge wizard (Esc exits connect mode).
      </p>
    </div>
  );
}
