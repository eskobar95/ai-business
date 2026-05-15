"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  Handle,
  Position,
  NodeProps,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useViewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentData = {
  name: string;
  role: string;
  isLead: boolean;
};

function monogram(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function AgentNode({ id, data }: NodeProps) {
  const d = data as AgentData;
  return (
    <div
      data-testid={`org-node-${id}`}
      className={cn(
        "w-[172px] rounded-lg border px-3 py-2.5 shadow-lg transition-shadow",
        d.isLead
          ? "border-primary/40 bg-primary/5"
          : "border-white/[0.10] bg-popover hover:border-white/[0.18]",
      )}
    >
      {!d.isLead && (
        <Handle
          type="target"
          position={Position.Top}
          style={{
            width: 8,
            height: 8,
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.2)",
            top: -5,
          }}
        />
      )}

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold",
            d.isLead ? "bg-primary/20 text-primary" : "bg-white/[0.07] text-muted-foreground",
          )}
        >
          {monogram(d.name)}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
          <div className="flex items-center gap-1.5">
            {d.isLead && <Crown className="size-3 shrink-0 text-primary/80" />}
            <span className="truncate text-[12px] font-medium leading-tight text-foreground">
              {d.name}
            </span>
          </div>
          <span
            className="text-[10px] leading-snug text-muted-foreground"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {d.role}
          </span>
        </div>
      </div>

      {d.isLead && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            width: 8,
            height: 8,
            background: "rgba(168,235,18,0.3)",
            border: "1px solid rgba(168,235,18,0.5)",
            bottom: -5,
          }}
        />
      )}
      {!d.isLead && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            width: 6,
            height: 6,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            bottom: -4,
          }}
        />
      )}
    </div>
  );
}

const nodeTypes = { agentNode: AgentNode };

function ZoomIndicator() {
  const { zoom } = useViewport();
  return (
    <div className="absolute bottom-3 right-3 z-10 select-none">
      <span className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground/30 bg-background/80 border border-white/[0.06] px-2 py-1 rounded-md tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}

type Member = {
  agentId: string;
  agent: {
    id: string;
    name: string;
    role: string;
  } | null;
};

type Props = {
  members: Member[];
  leadAgentId: string;
};

export function TeamOrgChart({ members, leadAgentId }: Props) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const validMembers = members.filter((m) => m.agent !== null);
    const lead = validMembers.find((m) => m.agentId === leadAgentId);
    const nonLeads = validMembers.filter((m) => m.agentId !== leadAgentId);

    // Node card is fixed 172px wide + 28px gap = 200px per slot.
    // Wrap into rows of max 4 so the chart doesn't stretch infinitely wide.
    const NODE_W = 172;
    const COL_GAP = 28;
    const ROW_GAP = 100;
    const COLS = Math.min(nonLeads.length, 4);
    const SLOT_W = NODE_W + COL_GAP;

    const totalChildWidth = COLS * SLOT_W - COL_GAP;
    const leadX = Math.max(0, (totalChildWidth - NODE_W) / 2);

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    if (lead?.agent) {
      nodes.push({
        id: lead.agentId,
        type: "agentNode",
        position: { x: leadX, y: 0 },
        data: { name: lead.agent.name, role: lead.agent.role, isLead: true },
      });
    }

    nonLeads.forEach((m, i) => {
      if (!m.agent) return;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = col * SLOT_W;
      const y = 160 + row * (80 + ROW_GAP);
      nodes.push({
        id: m.agentId,
        type: "agentNode",
        position: { x, y },
        data: { name: m.agent.name, role: m.agent.role, isLead: false },
      });

      if (lead) {
        edges.push({
          id: `${lead.agentId}->${m.agentId}`,
          source: lead.agentId,
          target: m.agentId,
          type: "smoothstep",
          style: { stroke: "rgba(255,255,255,0.12)", strokeWidth: 1.5 },
          animated: false,
        });
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [members, leadAgentId]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const rfStyle = { backgroundColor: "#111111" };

  if (members.filter((m) => m.agent).length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-card">
        <p className="text-[13px] text-muted-foreground">No members to chart.</p>
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-hidden"
      data-testid="org-chart"
      style={{ fontFamily: "inherit" }}
    >
      <style>{`
        .react-flow__attribution { display: none; }
        .react-flow__controls { bottom: 12px; left: 12px; }
        .react-flow__controls button {
          background: #1c1c1c;
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.5);
          width: 28px;
          height: 28px;
        }
        .react-flow__controls button:hover {
          background: #252525;
          color: rgba(255,255,255,0.8);
        }
        .react-flow__controls button svg { fill: currentColor; }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        style={rfStyle}
        fitView
        fitViewOptions={{ padding: 0.25, minZoom: 0.4, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Lines}
          color="rgba(255,255,255,0.035)"
          gap={32}
          lineWidth={0.5}
        />
        <Controls showInteractive={false} />
        <ZoomIndicator />
      </ReactFlow>
    </div>
  );
}
