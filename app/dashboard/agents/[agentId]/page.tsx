import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AgentDetailTabs } from "@/components/agents/agent-detail-tabs";
import { AgentRoutinesTab } from "@/components/agents/agent-routines-tab";
import { AgentSettingsForm } from "@/components/agents/agent-settings-form";
import { AgentOnboardingHint } from "@/components/agents/agent-onboarding-hint";
import { DocumentEditor } from "@/components/agents/document-editor";
import { McpInstaller } from "@/components/mcp/mcp-installer";
import { RunHeartbeatButton } from "@/components/agents/run-heartbeat-button";
import { SkillManager } from "@/components/agents/skill-manager";
import { getAgentsByBusiness } from "@/lib/agents/actions";
import { listSystemRoles } from "@/lib/system-roles/queries";
import { getAgentDocuments } from "@/lib/agents/document-actions";
import { getMcpCredentialsForAgent } from "@/lib/mcp/actions";
import { getSkillsByAgent, listSkillsByBusiness } from "@/lib/skills/actions";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";
import { listRoutinesByAgentId } from "@/lib/routines/queries";
import { getTasksByAgent } from "@/lib/tasks/actions";
import { getAgentStatus } from "@/lib/orchestration/events";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; dot: string; text: string }> = {
    working: {
      label: "Working",
      dot: "bg-status-active animate-pulse",
      text: "text-status-active",
    },
    awaiting_approval: {
      label: "Awaiting approval",
      dot: "bg-warning",
      text: "text-warning",
    },
    idle: {
      label: "Idle",
      dot: "bg-white/20",
      text: "text-muted-foreground",
    },
  };
  const s = map[status] ?? map.idle;
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full shrink-0", s.dot)} />
      <span className={cn("text-[11px] font-medium uppercase tracking-widest", s.text)}>
        {s.label}
      </span>
    </span>
  );
}

function TaskStatusTag({ status }: { status: string }) {
  const map: Record<string, string> = {
    blocked: "text-destructive bg-destructive/10",
    in_progress: "text-primary bg-primary/10",
    in_review: "text-blue-400 bg-blue-400/10",
    done: "text-success bg-success/10",
    backlog: "text-muted-foreground bg-white/[0.05]",
  };
  const cls = map[status] ?? "text-muted-foreground bg-white/[0.05]";
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-widest uppercase", cls)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ businessId?: string }>;
}) {
  const { agentId } = await params;
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/agents");

  const peers = await getAgentsByBusiness(businessId);
  const agent = peers.find((a) => a.id === agentId);
  if (!agent) notFound();

  const [attached, library, mcpMeta, agentDocs, tasks, lifecycle, platformSystemRoles, routineRows] =
    await Promise.all([
      getSkillsByAgent(agentId),
      listSkillsByBusiness(businessId),
      getMcpCredentialsForAgent(agentId),
      getAgentDocuments(agentId),
      getTasksByAgent(agentId),
      getAgentStatus(agentId),
      listSystemRoles(),
      listRoutinesByAgentId(agentId),
    ]);

  const recentTasks = tasks.slice(-10).reverse();

  const overviewContent = (
    <div className="flex flex-col gap-6">
      {/* Stats strip — Paperclip-style quick metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Skills", value: attached.length },
          { label: "MCP tools", value: mcpMeta.length },
          { label: "Tasks linked", value: tasks.length },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col rounded-md border border-border bg-card px-4 py-3"
          >
            <p className="section-label mb-1">{label}</p>
            <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent tasks — Paperclip-style table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="section-label">Recent tasks</p>
          <Link
            href="/dashboard/tasks"
            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            View all →
          </Link>
        </div>

        {recentTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-border py-10 text-center">
            <p className="text-[13px] text-muted-foreground">No tasks linked yet</p>
            <p className="text-[11px] text-muted-foreground/50">
              Tasks assigned to this agent will appear here
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_120px] border-b border-border px-4 py-2">
              <span className="section-label">Title</span>
              <span className="section-label">Status</span>
            </div>
            {/* Rows */}
            {recentTasks.map((t, i) => (
              <div
                key={t.id}
                className={cn(
                  "grid grid-cols-[1fr_120px] items-center px-4 py-2.5",
                  "hover:bg-white/[0.02] transition-colors",
                  i < recentTasks.length - 1 && "border-b border-white/[0.05]",
                )}
              >
                <span className="truncate text-[13px] text-foreground/90 tracking-[-0.01em]">
                  {t.title}
                </span>
                <div>
                  <TaskStatusTag status={t.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full flex-col">
      <Suspense fallback={null}>
        <AgentOnboardingHint businessId={businessId} agentId={agentId} />
      </Suspense>

      {/* Page header — h-14 flush with breadcrumb + action */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <nav className="flex items-center gap-2 text-[13px]" aria-label="Breadcrumb">
          <Link
            href={`/dashboard/agents?businessId=${encodeURIComponent(businessId)}`}
            className="text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            Agents
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-foreground font-medium">{agent.name}</span>
        </nav>
        <RunHeartbeatButton agentId={agentId} />
      </div>

      {/* Identity section — Paperclip-inspired: monogram + name + role + status */}
      <div className="flex items-center gap-4 border-b border-white/[0.06] px-6 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] font-mono text-[13px] font-semibold text-foreground/60">
          {agent.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-semibold tracking-[-0.02em] text-foreground">
            {agent.name}
          </h1>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{agent.role}</p>
        </div>
        <StatusPill status={lifecycle} />
      </div>

      {/* Tabs + content */}
      <div className="flex-1 overflow-hidden">
        <AgentDetailTabs
          overview={overviewContent}
          instructions={<DocumentEditor agentId={agentId} initialDocs={agentDocs} />}
          skills={
            <SkillManager
              agentId={agentId}
              businessId={businessId}
              attached={attached}
              library={library}
            />
          }
          routines={
            <AgentRoutinesTab
              businessId={businessId}
              agentId={agentId}
              initialRoutines={routineRows}
            />
          }
          mcp={<McpInstaller businessId={businessId} agentId={agentId} meta={mcpMeta} />}
          settings={
            <AgentSettingsForm
              businessId={businessId}
              agent={agent}
              peerAgents={peers}
              platformSystemRoles={platformSystemRoles}
            />
          }
        />
      </div>
    </div>
  );
}
