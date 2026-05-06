import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/index";
import { agents, tasks, teams } from "@/db/schema";

/** Slugs commonly granted promotion-friendly system roles (documentation / future policy hooks). */
export const PROMOTION_ALLOWLIST_SLUGS = [
  "engineering_manager",
  "product_owner",
  "lead",
] as const;

/**
 * Throws if the caller may not promote `taskId` from backlog → todo.
 *
 * Human callers: must already have passed `assertUserBusinessAccess` in the action.
 * Agent callers: require `systemRole.mayPromoteBacklogToTodo` or team lead for the task's team.
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
