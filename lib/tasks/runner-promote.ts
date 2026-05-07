import { getDb } from "@/db/index";
import { tasks } from "@/db/schema";
import { logEvent } from "@/lib/orchestration/events";
import { eq } from "drizzle-orm";

import { assertMayPromoteToTodo } from "./promotion-auth";
import { maybeAutoTriggerTask } from "./auto-trigger";

/**
 * Promotes a backlog task to `todo` from the local runner (no HTTP session).
 * Enforces the same agent RBAC as human-originated promotion via `assertMayPromoteToTodo`.
 */
export async function promoteTaskToTodoByRunner(
  taskId: string,
  promotingAgentId: string,
): Promise<void> {
  const db = getDb();
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });
  if (!task) throw new Error("Task not found");
  if (task.status !== "backlog") throw new Error("Task must be in backlog to promote");

  await assertMayPromoteToTodo(taskId, promotingAgentId, "agent");

  await db
    .update(tasks)
    .set({
      status: "todo",
      blockedReason: null,
      approvalId: null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  await logEvent({
    type: "task.promoted_to_todo",
    businessId: task.businessId,
    payload: { taskId, source: "runner_lead_heartbeat", promotingAgentId },
    status: "succeeded",
  });

  await maybeAutoTriggerTask(taskId);
}
