import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { TasksKanbanBoard } from "@/components/tasks/tasks-kanban-board";
import { Button } from "@/components/ui/button";
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
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/tasks");
  const businesses = await loadUserBusinesses();
  void businesses;

  const [tree, agents, teams] = await Promise.all([
    getTasksByBusiness(businessId),
    getAgentsByBusiness(businessId),
    listTeamsByBusiness(businessId),
  ]);

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
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="space-y-1">
              <p className="text-[13px] font-medium text-foreground/70">No tasks yet</p>
              <p className="text-[12px] text-muted-foreground/50">
                Tasks track orchestration work from backlog through done.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" data-testid="tasks-empty-cta">
              <Link href={`/dashboard/tasks/new?businessId=${encodeURIComponent(businessId)}`}>
                Create first task
              </Link>
            </Button>
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
            />
          </div>
        )}
      </div>
    </div>
  );
}
