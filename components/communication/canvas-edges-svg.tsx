"use client";

import { useId, useMemo } from "react";

import type { CommunicationEdgeRow } from "@/lib/communication/edge-store";
import { cn } from "@/lib/utils";

/** Layout box in the same coordinate space as the canvas container (relative). */
export type CanvasNodeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function midpointRight(r: CanvasNodeRect): { x: number; y: number } {
  return { x: r.left + r.width, y: r.top + r.height / 2 };
}

function midpointLeft(r: CanvasNodeRect): { x: number; y: number } {
  return { x: r.left, y: r.top + r.height / 2 };
}

function bezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  offset: number,
): string {
  const dx = Math.max(48, Math.abs(to.x - from.x) * 0.45);
  const cy1 = from.y + offset;
  const cy2 = to.y + offset;
  const c1x = from.x + dx;
  const c2x = to.x - dx;
  return `M ${from.x} ${from.y} C ${c1x} ${cy1}, ${c2x} ${cy2}, ${to.x} ${to.y}`;
}

export type CanvasEdgesSvgProps = {
  /** Pixel size of overlay (usually container clientWidth / clientHeight). */
  width: number;
  height: number;
  /** Map slug → bounding rect relative to container. */
  positions: Record<string, CanvasNodeRect | undefined>;
  edges: CommunicationEdgeRow[];
  selectedEdgeId: string | null;
  onEdgeClick: (edgeId: string) => void;
};

export function CanvasEdgesSvg({
  width,
  height,
  positions,
  edges,
  selectedEdgeId,
  onEdgeClick,
}: CanvasEdgesSvgProps) {
  const uid = useId().replace(/:/g, "");

  const { forwardPaths, backwardPaths } = useMemo(() => {
    type Seg = { id: string; d: string; selected: boolean };
    const fwd: Seg[] = [];
    const back: Seg[] = [];
    for (const edge of edges) {
      const a = positions[edge.fromRole];
      const b = positions[edge.toRole];
      if (!a || !b) continue;
      const from = midpointRight(a);
      const to = midpointLeft(b);
      const selected = selectedEdgeId === edge.id;
      if (edge.direction === "bidirectional") {
        fwd.push({
          id: edge.id,
          d: bezierPath(from, to, -3),
          selected,
        });
        back.push({
          id: `${edge.id}-rev`,
          d: bezierPath(to, from, 3),
          selected,
        });
      } else {
        fwd.push({ id: edge.id, d: bezierPath(from, to, 0), selected });
      }
    }
    return { forwardPaths: fwd, backwardPaths: back };
  }, [edges, positions, selectedEdgeId]);

  if (width <= 0 || height <= 0) return null;

  return (
    <svg
      className="text-muted-foreground/55 pointer-events-none absolute inset-0 overflow-visible"
      width={width}
      height={height}
      aria-hidden
    >
      <defs>
        <marker
          id={`arrow-${uid}`}
          markerWidth={10}
          markerHeight={10}
          refX={9}
          refY={3}
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" className="fill-current" />
        </marker>
      </defs>
      <g className="pointer-events-auto">
        {[...backwardPaths, ...forwardPaths].map((p) => (
          <path
            key={p.id}
            d={p.d}
            fill="none"
            markerEnd={`url(#arrow-${uid})`}
            stroke="currentColor"
            strokeWidth={p.selected ? 2.25 : 1.25}
            strokeLinecap="round"
            className={cn(
              "cursor-pointer transition-[stroke-opacity,stroke-width]",
              p.selected ? "text-primary" : "hover:text-foreground/70",
            )}
            data-testid={p.selected ? `canvas-edge-selected` : "canvas-edge"}
            onClick={(e) => {
              e.stopPropagation();
              const base = p.id.replace(/-rev$/, "");
              onEdgeClick(base);
            }}
          />
        ))}
      </g>
    </svg>
  );
}
