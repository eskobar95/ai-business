"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LayoutGrid, List, Search } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentCardAgent } from "@/components/agents/agent-card";
import { AgentCard } from "@/components/agents/agent-card";
import { AgentRosterAvatar } from "@/components/agents/agent-roster-avatar";
import { Card } from "@/components/ui/card";
import { PageEmptyState } from "@/components/page-empty-state";
import { AgentStatusBadge } from "@/components/agents/agent-status-badge";
import { cn } from "@/lib/utils";
import type { AgentLifecycleStatus } from "@/lib/orchestration/events";

export type RosterRow = {
  agent: AgentCardAgent;
  skillCount: number;
  mcpCount: number;
  lifecycle: AgentLifecycleStatus;
};

function ViewToggle({
  view,
  onChange,
}: {
  view: "cards" | "list";
  onChange: (v: "cards" | "list") => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("cards")}
        aria-pressed={view === "cards"}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-[12px] transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
          view === "cards"
            ? "bg-white/[0.08] text-foreground"
            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        )}
      >
        <LayoutGrid className="size-3.5" />
        Cards
      </button>
      <div className="w-px bg-white/[0.08]" />
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={view === "list"}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-[12px] transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
          view === "list"
            ? "bg-white/[0.08] text-foreground"
            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        )}
      >
        <List className="size-3.5" />
        List
      </button>
    </div>
  );
}

export function AgentsRosterClient({
  businessId,
  rows,
  emptyCta,
}: {
  businessId: string;
  rows: RosterRow[];
  emptyCta: ReactNode;
}) {
  const [view, setView] = useState<"cards" | "list">("cards");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.agent.name.toLowerCase().includes(s) || r.agent.role.toLowerCase().includes(s),
    );
  }, [rows, q]);

  if (rows.length === 0) {
    return (
      <PageEmptyState
        title="No agents yet"
        description="Agents are the roster entries Cursor and webhooks orchestrate: each has a role, instructions, skills, and MCP tools."
      >
        {emptyCta}
      </PageEmptyState>
    );
  }

  return (
    <div className="flex flex-col" data-testid="agents-roster">
      {/* Toolbar */}
      <div className="flex items-center gap-3 pb-4">
        {/* Search */}
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground/50" aria-hidden />
          <input
            type="search"
            placeholder="Search agents…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={cn(
              "h-8 w-full min-w-0 rounded-md border border-border bg-transparent",
              "pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/40",
              "outline-none transition-colors focus:border-white/[0.16]",
            )}
          />
        </div>

        {/* View toggle */}
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* Separator */}
      <div className="divider-subtle" />

      {/* Content */}
      {view === "cards" ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="agents-grid">
          {filtered.map(({ agent: a, skillCount, mcpCount, lifecycle }) => (
            <AgentCard
              key={a.id}
              agent={a}
              businessId={businessId}
              skillCount={skillCount}
              mcpCount={mcpCount}
              status={lifecycle}
            />
          ))}
        </ul>
      ) : (
        /* List view — Supabase-style table */
        <Card padding="" className="mt-4 overflow-hidden" data-testid="agents-list">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_80px_80px] border-b border-border px-4 py-2">
            <span className="section-label">Agent</span>
            <span className="section-label">Status</span>
            <span className="section-label">Skills</span>
            <span className="section-label">MCP</span>
          </div>
          {/* Rows */}
          {filtered.map(({ agent: a, skillCount, mcpCount, lifecycle }, i) => (
            <Link
              key={a.id}
              href={`/dashboard/agents/${a.id}?businessId=${encodeURIComponent(businessId)}`}
              data-testid={`agent-card-${a.id}`}
              className={cn(
                "grid grid-cols-[1fr_120px_80px_80px] items-center px-4 py-3 transition-colors hover:bg-white/[0.04]",
                i < filtered.length - 1 && "border-b border-white/[0.05]",
              )}
            >
              {/* Name + role */}
              <div className="flex items-center gap-3 min-w-0">
                <AgentRosterAvatar
                  name={a.name}
                  avatarUrl={a.avatarUrl}
                  iconKey={a.iconKey}
                  sizeClasses="size-7 shrink-0 rounded-md text-[11px]"
                />
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate text-[13px] font-medium text-foreground tracking-[-0.01em]">
                      {a.name}
                    </p>
                    {a.isPlatformDefault ? (
                      <span className="shrink-0 rounded border border-white/[0.14] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Platform
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate font-mono text-[10px] text-muted-foreground/60">
                    {a.role}
                  </p>
                </div>
              </div>
              {/* Status */}
              <div>
                <AgentStatusBadge agentId={a.id} status={lifecycle} />
              </div>
              {/* Skills */}
              <span className="font-mono text-[12px] text-muted-foreground" data-testid={`agent-skills-count-${a.id}`}>
                {skillCount}
              </span>
              {/* MCP */}
              <span className="font-mono text-[12px] text-muted-foreground" data-testid={`agent-mcp-count-${a.id}`}>
                {mcpCount}
              </span>
            </Link>
          ))}
        </Card>
      )}

      {filtered.length === 0 && q && (
        <p className="mt-8 text-center text-[13px] text-muted-foreground">
          No agents match <span className="text-foreground">&ldquo;{q}&rdquo;</span>
        </p>
      )}
    </div>
  );
}
