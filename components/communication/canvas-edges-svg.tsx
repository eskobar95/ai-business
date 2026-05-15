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

type Pt = { x: number; y: number };

function midRight(r: CanvasNodeRect): Pt { return { x: r.left + r.width, y: r.top + r.height / 2 }; }
function midLeft(r: CanvasNodeRect): Pt  { return { x: r.left,            y: r.top + r.height / 2 }; }

/**
 * Chooses the shortest sensible route between two nodes:
 * - Cross-column: exits the inner side of A, enters the inner side of B (clean horizontal bezier).
 * - Same-column:  exits the outer side of both nodes, curves around on the outside (no crossing
 *   through the canvas centre).
 *
 * `yOffset` nudges bidirectional parallel legs slightly apart so they don't sit on top of each other.
 */
function smartPath(
  a: CanvasNodeRect,
  b: CanvasNodeRect,
  canvasWidth: number,
  yOffset = 0,
): string {
  const mid = canvasWidth / 2;
  const aIsLeft = a.left + a.width / 2 < mid;
  const bIsLeft = b.left + b.width / 2 < mid;

  if (aIsLeft !== bIsLeft) {
    // ── Cross-column ──────────────────────────────────────────────────
    const from: Pt = aIsLeft ? midRight(a) : midLeft(a);
    const to:   Pt = bIsLeft ? midRight(b) : midLeft(b);
    const f = { x: from.x, y: from.y + yOffset };
    const t = { x: to.x,   y: to.y   + yOffset };
    const dx = Math.max(56, Math.abs(t.x - f.x) * 0.38);
    const cx1 = f.x + (aIsLeft ?  dx : -dx);
    const cx2 = t.x + (bIsLeft ?  dx : -dx);
    return `M ${f.x} ${f.y} C ${cx1} ${f.y}, ${cx2} ${t.y}, ${t.x} ${t.y}`;
  } else {
    // ── Same-column: route outward ────────────────────────────────────
    const goLeft = aIsLeft; // product lanes exit left; build lanes exit right
    const from: Pt = goLeft ? midLeft(a)  : midRight(a);
    const to:   Pt = goLeft ? midLeft(b)  : midRight(b);
    const f = { x: from.x, y: from.y + yOffset };
    const t = { x: to.x,   y: to.y   + yOffset };
    // Pull control points 52 px outward so the curve stays outside the column
    const margin = 52;
    const cx = goLeft ? Math.min(f.x, t.x) - margin : Math.max(f.x, t.x) + margin;
    return `M ${f.x} ${f.y} C ${cx} ${f.y}, ${cx} ${t.y}, ${t.x} ${t.y}`;
  }
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
      const selected = selectedEdgeId === edge.id;
      if (edge.direction === "bidirectional") {
        // Nudge the two legs 4 px apart in Y so they don't overlap
        fwd.push({ id: edge.id,         d: smartPath(a, b, width, -4), selected });
        back.push({ id: `${edge.id}-rev`, d: smartPath(b, a, width,  4), selected });
      } else {
        fwd.push({ id: edge.id, d: smartPath(a, b, width, 0), selected });
      }
    }
    return { forwardPaths: fwd, backwardPaths: back };
  }, [edges, positions, selectedEdgeId, width]);

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
