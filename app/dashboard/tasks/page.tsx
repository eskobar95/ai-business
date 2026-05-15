import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { TasksKanbanBoard } from "@/components/tasks/tasks-kanban-board";
import { Button } from "@/components/ui/button";
import { ConductorNudge } from "@/components/dashboard/conductor-nudge";
import { loadUserBusinesses, resolveBusinessIdParam } from "@/lib/dashboard/business-scope";
import { getAgentsByBusiness } from "@/lib/agents/actions";
import { getTasksByBusiness } from "@/lib/tasks/actions";
import { flattenTaskTree } from "@/lib/tasks/flatten-task-tree";
import type { TaskStatus } from "@/lib/tasks/task-tree";
import { listTeamsByBusiness } from "@/lib/teams/actions";

export const dynamic = "force-dynamic";

function groupByStatus<T extends { status: TaskStatus }>(rows: T[]): Record<TaskStatus, T[]> {
  const empty: Record<TaskStatus, T[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    blocked: [],
    in_review: [],
    done: [],
  };
  for (const r of rows) {
    empty[r.status].push(r);
  }
  return empty;
}

export default async function TasksDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string; teamId?: string }>;
}) {
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/tasks");
  const businesses = await loadUserBusinesses();
  void businesses;

  const rawTeamId = typeof sp.teamId === "string" ? sp.teamId.trim() : "";
  const teamIdFromUrl = rawTeamId.length > 0 ? rawTeamId : undefined;

  const [agents, teams] = await Promise.all([
    getAgentsByBusiness(businessId),
    listTeamsByBusiness(businessId),
  ]);

  let scopedTeamId: string | undefined;
  let activeTeamName: string | undefined;
  if (teamIdFromUrl) {
    const match = teams.find((t) => t.id === teamIdFromUrl);
    if (!match) {
      redirect(`/dashboard/tasks?businessId=${encodeURIComponent(businessId)}`);
    }
    scopedTeamId = match.id;
    activeTeamName = match.name;
  }

  const tree = await getTasksByBusiness(businessId, scopedTeamId);

  const flat = flattenTaskTree(tree);
  const grouped = groupByStatus(flat);

  const agentNames = Object.fromEntries(agents.map((a) => [a.id, a.name]));
  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  const agentList = agents.map((a) => ({ id: a.id, name: a.name }));
  const teamList = teams.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <PageHeader
        title="Tasks"
        action={
          flat.length > 0 ? (
            <span className="font-mono text-[11px] text-muted-foreground/40 tabular-nums">
              {flat.length}
            </span>
          ) : undefined
        }
      />

      {/* Board area */}
      <div className="flex-1 overflow-auto">
        {flat.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground">
              <ClipboardList className="size-8" aria-hidden />
            </span>
            <div className="max-w-md space-y-2">
              <p className="text-[15px] font-semibold text-foreground">Ingen tasks endnu</p>
              <p className="text-[13px] text-muted-foreground/80">
                Opret en mission og lad Product Owner kickstarte sprint-planlægningen.
              </p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <Button asChild variant="default" data-testid="tasks-empty-cta">
                <Link href={`/dashboard/missions?businessId=${encodeURIComponent(businessId)}`}>
                  Gå til missions →
                </Link>
              </Button>
              <ConductorNudge businessId={businessId} />
            </div>
          </div>
        ) : (
          <div className="p-6">
            <TasksKanbanBoard
              grouped={grouped}
              agentNames={agentNames}
              teamNames={teamNames}
              businessId={businessId}
              agents={agentList}
              teams={teamList}
              activeTeamName={activeTeamName}
              scopedTeamId={scopedTeamId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
