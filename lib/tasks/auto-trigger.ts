import { getDb } from "@/db/index";
import { tasks } from "@/db/schema";
import { logEvent } from "@/lib/orchestration/events";
import { and, eq, isNull } from "drizzle-orm";

import { evaluateTaskGates } from "./gate-evaluator";

/**
 * Evaluates gates for a todo task and creates a webhook_trigger if ready.
 * Idempotent: uses gatesLockedAt as a guard against double-trigger.
 */
export async function maybeAutoTriggerTask(
  taskId: string,
): Promise<{ triggered: boolean; reasons?: string[] }> {
  const db = getDb();

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    columns: {
      status: true,
      businessId: true,
      agentId: true,
      gatesLockedAt: true,
    },
  });

  if (!task) return { triggered: false };

  if (task.status !== "todo") return { triggered: false };

  if (task.gatesLockedAt !== null) return { triggered: false };

  const gates = await evaluateTaskGates(taskId);
  if (!gates.ready) return { triggered: false, reasons: gates.reasons };

  const now = new Date();
  const [won] = await db
    .update(tasks)
    .set({ gatesLockedAt: now, updatedAt: now })
    .where(and(eq(tasks.id, taskId), isNull(tasks.gatesLockedAt)))
    .returning({ id: tasks.id });

  if (!won) return { triggered: false };

  await logEvent({
    type: "webhook_trigger",
    businessId: task.businessId,
    payload: {
      taskId,
      ...(task.agentId != null ? { agentId: task.agentId } : {}),
      trigger: "auto_todo",
    },
    status: "pending",
  });

  return { triggered: true };
}
