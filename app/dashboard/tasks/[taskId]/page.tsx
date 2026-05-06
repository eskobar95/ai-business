import { notFound, redirect } from "next/navigation";

import { TaskDetailClient } from "@/components/tasks/task-detail-client";
import { auth } from "@/lib/auth/server";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";
import { getAgentsByBusiness } from "@/lib/agents/actions";
import { getTaskById, getTaskRelations, getRecentTasksForBusiness, listGithubInstallationsForBusiness, getBusinessIntegrationBranch } from "@/lib/tasks/actions";
import { getTaskLogs } from "@/lib/tasks/log-actions";
import { listTeamsByBusiness } from "@/lib/teams/actions";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ businessId?: string }>;
}) {
  const { taskId } = await params;
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/tasks");

  const task = await getTaskById(taskId);
  if (!task || task.businessId !== businessId) {
    notFound();
  }

  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") {
    redirect("/auth/sign-in");
  }

  const [agents, logs, teams, relations, recentTasks, githubInstallations, integrationBranch] = await Promise.all([
    getAgentsByBusiness(businessId),
    getTaskLogs(taskId),
    listTeamsByBusiness(businessId),
    getTaskRelations(task.id, businessId),
    getRecentTasksForBusiness(businessId, 50),
    listGithubInstallationsForBusiness(businessId),
    getBusinessIntegrationBranch(businessId),
  ]);

  let dependencyTask: { id: string; title: string; status: string } | null = null;
  if (task.dependencyTaskId) {
    const dep = await getTaskById(task.dependencyTaskId);
    if (dep) {
      dependencyTask = { id: dep.id, title: dep.title, status: dep.status };
    }
  }

  const agentNames = Object.fromEntries(agents.map((a) => [a.id, a.name]));
  const assignedName = task.agentId ? (agentNames[task.agentId] ?? null) : null;
  const teamName = task.teamId ? (teams.find((t) => t.id === task.teamId)?.name ?? null) : null;

  const allAgents = agents.map((a) => ({ id: a.id, name: a.name }));
  const allTeams = teams.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TaskDetailClient
        task={task}
        agentName={assignedName}
        teamName={teamName}
        agentId={task.agentId}
        teamId={task.teamId}
        logs={logs.map((l) => ({
          id: l.id,
          authorType: l.authorType,
          authorId: l.authorId,
          content: l.content,
          createdAt: l.createdAt,
        }))}
        agentNames={agentNames}
        currentUserId={userId}
        businessId={businessId}
        allAgents={allAgents}
        allTeams={allTeams}
        taskRelations={relations}
        allTasks={recentTasks}
        dependencyTask={dependencyTask}
        githubInstallations={githubInstallations}
        integrationBranch={integrationBranch}
      />
    </div>
  );
}
