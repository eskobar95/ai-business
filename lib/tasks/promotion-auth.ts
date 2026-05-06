import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/index";
import { agents, tasks, teams } from "@/db/schema";

/**
 * Throws if the caller may not promote `taskId` from backlog → todo.
 *
 * **Policy (authoritative):** `system_roles.may_promote_backlog_to_todo` on the agent's role, or
 * the agent is `teams.lead_agent_id` for the task’s team. There is no separate slug allowlist in code —
 * seed/configuration should set flags on roles (e.g. engineering_manager, product_owner, lead).
 *
 * Human callers: must already have passed `assertUserBusinessAccess` in the action.
 * Agent callers: evaluated against DB flags as above.
 */
export async function assertMayPromoteToTodo(
  taskId: string,
  callerId: string,
  callerType: "human" | "agent",
): Promise<void> {
  if (callerType === "human") return;

  const db = getDb();

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    columns: { businessId: true, teamId: true },
  });
  if (!task) throw new Error("Task not found");

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, callerId), eq(agents.businessId, task.businessId)),
    with: {
      systemRole: {
        columns: { mayPromoteBacklogToTodo: true, slug: true },
      },
    },
  });

  if (!agent) throw new Error("Agent not found in this business");

  if (agent.systemRole?.mayPromoteBacklogToTodo === true) return;

  if (task.teamId) {
    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, task.teamId), eq(teams.businessId, task.businessId)),
      columns: { leadAgentId: true },
    });
    if (team?.leadAgentId === callerId) return;
  }

  throw new Error("Agent is not authorized to promote tasks to todo");
}
