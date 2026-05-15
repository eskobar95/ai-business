import Link from "next/link";

import { AgentRosterAvatar } from "@/components/agents/agent-roster-avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AgentLifecycleStatus } from "@/lib/orchestration/events";

export type AgentCardAgent = {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  iconKey?: string | null;
  isPlatformDefault?: boolean;
};

function statusDot(status: AgentLifecycleStatus) {
  switch (status) {
    case "working":
      return "bg-status-active animate-pulse";
    case "awaiting_approval":
      return "bg-warning";
    case "idle":
    default:
      return "bg-status-idle";
  }
}

function statusLabel(status: AgentLifecycleStatus) {
  switch (status) {
    case "working":
      return { text: "Working", cls: "text-status-active" };
    case "awaiting_approval":
      return { text: "Awaiting approval", cls: "text-warning" };
    default:
      return { text: "Idle", cls: "text-muted-foreground" };
  }
}

export function AgentCard(props: {
  agent: AgentCardAgent;
  businessId: string;
  skillCount: number;
  mcpCount: number;
  status: AgentLifecycleStatus;
}) {
  const { agent: a, businessId, skillCount, mcpCount, status } = props;
  const dot = statusDot(status);
  const lbl = statusLabel(status);

  return (
    <Card as="li" padding="p-4" interactive className="group flex flex-col">
      <Link
        href={`/dashboard/agents/${a.id}?businessId=${encodeURIComponent(businessId)}`}
        data-testid={`agent-card-${a.id}`}
        className="flex flex-col"
      >
        {/* Top row: monogram + name/role + status */}
        <div className="flex items-start gap-3">
          <AgentRosterAvatar
            name={a.name}
            avatarUrl={a.avatarUrl}
            iconKey={a.iconKey}
            sizeClasses="size-8 rounded-md mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-foreground">
                {a.name}
              </p>
              {a.isPlatformDefault ? (
                <span
                  className="shrink-0 rounded border border-white/[0.14] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-muted-foreground"
                  data-testid="agent-platform-badge"
                >
                  Platform
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{a.role}</p>
          </div>
          <span
            data-testid={`agent-status-${a.id}`}
            className="flex shrink-0 items-center gap-1.5 pt-0.5"
          >
            <span className={cn("size-1.5 rounded-full", dot)} />
            <span className={cn("text-[10px] font-medium tracking-widest uppercase", lbl.cls)}>
              {lbl.text}
            </span>
          </span>
        </div>

        {/* Bottom: skills + MCP metadata */}
        <div className="mt-4 flex items-center gap-3 border-t border-white/[0.05] pt-3">
          <span
            data-testid={`agent-skills-count-${a.id}`}
            className="font-mono text-[11px] text-muted-foreground/70"
          >
            {skillCount} skills
          </span>
          <span className="text-white/[0.15]">·</span>
          <span
            data-testid={`agent-mcp-count-${a.id}`}
            className="font-mono text-[11px] text-muted-foreground/70"
          >
            {mcpCount} MCP
          </span>
        </div>
      </Link>
    </Card>
  );
}
