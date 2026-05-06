import { getDb } from "@/db/index";
import { tasks } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface GateResult {
  ready: boolean;
  dependencyOk: boolean;
  prOk: boolean;
  /** Human-readable reasons when NOT ready */
  reasons: string[];
}

/**
 * Evaluates whether a task's gates are satisfied for auto-start.
 *
 * Gate logic (AND when both are set):
 *   dependency_ok = dependencyTaskId IS NULL || dependency.status === 'done'
 *   pr_ok         = githubPrNumber IS NULL   || prMergedToIntegration === true
 *   ready         = dependency_ok && pr_ok
 */
export async function evaluateTaskGates(taskId: string): Promise<GateResult> {
  const db = getDb();

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    columns: {
      dependencyTaskId: true,
      githubPrNumber: true,
      prMergedToIntegration: true,
    },
  });

  if (!task) throw new Error(`Task ${taskId} not found`);

  const reasons: string[] = [];
  let dependencyOk = true;
  let prOk = true;

  if (task.dependencyTaskId) {
    const dep = await db.query.tasks.findFirst({
      where: eq(tasks.id, task.dependencyTaskId),
      columns: { status: true, title: true },
    });
    if (!dep || dep.status !== "done") {
      dependencyOk = false;
      reasons.push(
        `Dependency task "${dep?.title ?? task.dependencyTaskId}" is not done (status: ${dep?.status ?? "not found"})`,
      );
    }
  }

  if (task.githubPrNumber !== null && task.githubPrNumber !== undefined) {
    if (!task.prMergedToIntegration) {
      prOk = false;
      reasons.push(`PR #${task.githubPrNumber} has not been merged to integration branch`);
    }
  }

  const ready = dependencyOk && prOk;

  return { ready, dependencyOk, prOk, reasons };
}
