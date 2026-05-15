"use server";

import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { assertUserOwnsAgent } from "@/lib/agents/actions";
import { getDb } from "@/db/index";
import { approvals, businesses, githubInstallations, tasks, taskRelations } from "@/db/schema";
import { logEvent } from "@/lib/orchestration/events";
import { requireSessionUserId } from "@/lib/roster/session";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";

import { assertMayPromoteToTodo } from "./promotion-auth";
import { maybeAutoTriggerTask } from "./auto-trigger";

import {
  buildDeleteOrderForSubtree,
  collectSubtreeIds,
  type TaskRow,
  type TaskStatus,
  type TaskTreeNode,
} from "./task-tree";

export async function getTaskById(taskId: string): Promise<TaskRow | null> {
  const userId = await requireSessionUserId();
  const db = getDb();
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });
  if (!task) return null;
  await assertUserBusinessAccess(userId, task.businessId);
  return task;
}

async function assertTaskInBusinessForUser(taskId: string): Promise<TaskRow> {
  const userId = await requireSessionUserId();
  const db = getDb();
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });
  if (!task) throw new Error("Task not found");
  await assertUserBusinessAccess(userId, task.businessId);
  return task;
}

async function assertParentInSameBusiness(
  businessId: string,
  parentTaskId: string | null | undefined,
): Promise<void> {
  if (!parentTaskId) return;
  const db = getDb();
  const parent = await db.query.tasks.findFirst({
    where: eq(tasks.id, parentTaskId),
    columns: { businessId: true },
  });
  if (!parent || parent.businessId !== businessId) {
    throw new Error("Parent task must belong to the same business");
  }
}

async function assertApprovalInBusiness(businessId: string, approvalId: string): Promise<void> {
  const db = getDb();
  const appr = await db.query.approvals.findFirst({
    where: eq(approvals.id, approvalId),
    columns: { businessId: true },
  });
  if (!appr?.businessId || appr.businessId !== businessId) {
    throw new Error("Approval not found for this business");
  }
}

const MAX_DEPENDENCY_CHAIN_STEPS = 64;

/** Walking `newDependencyId` → its `dependency_task_id`; if we reach `taskId`, linking would create a cycle. */
async function assertDependencyWouldNotCreateCycle(
  taskId: string,
  newDependencyId: string,
): Promise<void> {
  const db = getDb();
  let cursor: string | null = newDependencyId;
  for (let step = 0; step < MAX_DEPENDENCY_CHAIN_STEPS && cursor; step++) {
    if (cursor === taskId) {
      throw new Error("Circular task dependencies are not allowed");
    }
    const row: { dependencyTaskId: string | null } | undefined = await db.query.tasks.findFirst({
      where: eq(tasks.id, cursor),
      columns: { dependencyTaskId: true },
    });
    cursor = row?.dependencyTaskId ?? null;
  }
  if (cursor !== null) {
    throw new Error("Task dependency chain exceeds maximum depth");
  }
}

/**
 * Backlog → todo with RBAC, audit log, and fields aligned with `updateTaskStatus` (clears blocked + approval link).
 * Pass `preloadedTask` when the row was just loaded (e.g. from `updateTaskStatus`) to avoid an extra query.
 */
async function promoteBacklogToTodoFromSession(taskId: string, preloadedTask?: TaskRow): Promise<void> {
  const userId = await requireSessionUserId();
  const db = getDb();
  const task =
    preloadedTask ??
    (await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    }));
  if (!task) throw new Error("Task not found");
  if (task.id !== taskId) throw new Error("Task not found");
  await assertUserBusinessAccess(userId, task.businessId);
  if (task.status !== "backlog") throw new Error("Task must be in backlog to promote");
  await assertMayPromoteToTodo(taskId, userId, "human");

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
    payload: { taskId },
    status: "succeeded",
  });

  await maybeAutoTriggerTask(taskId);
}

export async function createTask(
  businessId: string,
  input: {
    title: string;
    description?: string;
    teamId?: string | null;
    agentId?: string | null;
    parentTaskId?: string | null;
    status?: TaskStatus;
    blockedReason?: string | null;
  },
): Promise<{ id: string }> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);

  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  await assertParentInSameBusiness(businessId, input.parentTaskId ?? null);

  const status = input.status ?? "backlog";

  const db = getDb();
  const [row] = await db
    .insert(tasks)
    .values({
      businessId,
      title,
      description: (input.description ?? "").trim(),
      teamId: input.teamId ?? null,
      agentId: input.agentId ?? null,
      parentTaskId: input.parentTaskId ?? null,
      status,
      blockedReason: status === "blocked" ? (input.blockedReason?.trim() ?? null) : null,
    })
    .returning({ id: tasks.id });

  if (!row) throw new Error("Failed to create task");

  if (status === "todo") {
    await logEvent({
      type: "task.promoted_to_todo",
      businessId,
      payload: { taskId: row.id, source: "create_task" },
      status: "succeeded",
    });
  }

  return row;
}

export async function updateTask(
  taskId: string,
  patch: {
    title?: string;
    description?: string;
    agentId?: string | null;
    teamId?: string | null;
    parentTaskId?: string | null;
  },
): Promise<void> {
  const task = await assertTaskInBusinessForUser(taskId);
  const db = getDb();

  if (patch.parentTaskId !== undefined && patch.parentTaskId !== null) {
    if (patch.parentTaskId === taskId) throw new Error("Task cannot be its own parent");
    await assertParentInSameBusiness(task.businessId, patch.parentTaskId);
  }

  const updates: Partial<typeof tasks.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new Error("Title is required");
    updates.title = t;
  }
  if (patch.description !== undefined) updates.description = patch.description.trim();
  if (patch.agentId !== undefined) updates.agentId = patch.agentId;
  if (patch.teamId !== undefined) updates.teamId = patch.teamId;
  if (patch.parentTaskId !== undefined) updates.parentTaskId = patch.parentTaskId;

  await db.update(tasks).set(updates).where(eq(tasks.id, taskId));
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  opts?: { blockedReason?: string | null; approvalId?: string | null },
): Promise<void> {
  const task = await assertTaskInBusinessForUser(taskId);

  if (task.status === "backlog" && status === "todo") {
    await promoteBacklogToTodoFromSession(taskId, task);
    return;
  }

  const db = getDb();

  const updates: Partial<typeof tasks.$inferInsert> = {
    status,
    updatedAt: new Date(),
  };

  if (status === "blocked") {
    updates.blockedReason = opts?.blockedReason?.trim() || null;
  } else {
    updates.blockedReason = null;
  }

  if (status === "in_review") {
    const approvalId = opts?.approvalId ?? null;
    if (approvalId) {
      await assertApprovalInBusiness(task.businessId, approvalId);
    }
    updates.approvalId = approvalId;
  } else {
    updates.approvalId = null;
  }

  await db.update(tasks).set(updates).where(eq(tasks.id, taskId));

  if (status === "done") {
    const dependents = await db.query.tasks.findMany({
      where: and(
        eq(tasks.dependencyTaskId, taskId),
        eq(tasks.status, "todo"),
      ),
      columns: { id: true },
    });
    for (const dep of dependents) {
      await maybeAutoTriggerTask(dep.id);
    }
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const task = await assertTaskInBusinessForUser(taskId);
  const db = getDb();

  const allInBusiness = await db.query.tasks.findMany({
    where: eq(tasks.businessId, task.businessId),
    columns: { id: true, parentTaskId: true },
  });

  const subtree = collectSubtreeIds(taskId, allInBusiness);
  const deleteOrder = buildDeleteOrderForSubtree(taskId, subtree, allInBusiness);

  await db.delete(tasks).where(inArray(tasks.id, deleteOrder));
}

export async function getTasksByBusiness(businessId: string): Promise<TaskTreeNode[]> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);

  const db = getDb();
  const rows = await db.query.tasks.findMany({
    where: eq(tasks.businessId, businessId),
    orderBy: [asc(tasks.createdAt)],
  });

  return buildTree(rows);
}

export async function getTasksByAgent(agentId: string): Promise<TaskRow[]> {
  await assertUserOwnsAgent(agentId);
  const db = getDb();
  return db.query.tasks.findMany({
    where: eq(tasks.agentId, agentId),
    orderBy: [asc(tasks.updatedAt)],
  });
}

export async function updateTaskLabels(taskId: string, labels: string[]): Promise<void> {
  await assertTaskInBusinessForUser(taskId);
  const db = getDb();
  await db.update(tasks).set({ labels, updatedAt: new Date() }).where(eq(tasks.id, taskId));
}

export async function updateTaskPriority(taskId: string, priority: string): Promise<void> {
  await assertTaskInBusinessForUser(taskId);
  const db = getDb();
  await db.update(tasks).set({ priority, updatedAt: new Date() }).where(eq(tasks.id, taskId));
}

export async function updateTaskMission(taskId: string, mission: string | null): Promise<void> {
  await assertTaskInBusinessForUser(taskId);
  const db = getDb();
  const normalizedMission = mission?.trim() || null;
  await db
    .update(tasks)
    .set({ mission: normalizedMission, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

export async function updateTaskAssignee(taskId: string, agentId: string | null): Promise<void> {
  await assertTaskInBusinessForUser(taskId);
  const db = getDb();
  await db.update(tasks).set({ agentId, updatedAt: new Date() }).where(eq(tasks.id, taskId));
}

export async function updateTaskTeam(taskId: string, teamId: string | null): Promise<void> {
  await assertTaskInBusinessForUser(taskId);
  const db = getDb();
  await db.update(tasks).set({ teamId, updatedAt: new Date() }).where(eq(tasks.id, taskId));
}

export async function promoteTaskToTodo(taskId: string): Promise<void> {
  await promoteBacklogToTodoFromSession(taskId);
}

export async function updateTaskDependency(taskId: string, dependencyTaskId: string | null): Promise<void> {
  const task = await assertTaskInBusinessForUser(taskId);
  const db = getDb();
  if (dependencyTaskId === null) {
    await db
      .update(tasks)
      .set({ dependencyTaskId: null, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));
    return;
  }
  if (dependencyTaskId === taskId) {
    throw new Error("Task cannot depend on itself");
  }
  const dep = await db.query.tasks.findFirst({
    where: eq(tasks.id, dependencyTaskId),
    columns: { businessId: true },
  });
  if (!dep) throw new Error("Dependency task not found");
  if (dep.businessId !== task.businessId) {
    throw new Error("Dependency task must belong to the same business");
  }

  await assertDependencyWouldNotCreateCycle(taskId, dependencyTaskId);

  await db
    .update(tasks)
    .set({ dependencyTaskId, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

export async function updateTaskPrLink(
  taskId: string,
  input: { githubPrNumber: number | null; githubRepoInstallationId: string | null },
): Promise<void> {
  const task = await assertTaskInBusinessForUser(taskId);
  const db = getDb();
  const pr = input.githubPrNumber;
  const inst = input.githubRepoInstallationId;
  const hasPr = pr != null;
  const hasInst = inst != null;
  if (hasPr !== hasInst) {
    throw new Error("PR number and repository must both be set or both cleared");
  }
  if (hasPr && pr != null) {
    if (!Number.isInteger(pr) || pr < 1) {
      throw new Error("PR number must be a positive integer");
    }
    const row = await db.query.githubInstallations.findFirst({
      where: and(eq(githubInstallations.id, inst!), eq(githubInstallations.businessId, task.businessId)),
      columns: { id: true },
    });
    if (!row) throw new Error("GitHub installation not found for this business");
  }

  await db
    .update(tasks)
    .set({
      githubPrNumber: hasPr ? pr : null,
      githubRepoInstallationId: hasInst ? inst : null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));
}

export async function listGithubInstallationsForBusiness(
  businessId: string,
): Promise<{ id: string; label: string }[]> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);
  const db = getDb();
  const rows = await db.query.githubInstallations.findMany({
    where: eq(githubInstallations.businessId, businessId),
    columns: { id: true, accountLogin: true, repos: true },
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.repos?.[0] ? `${r.repos[0]} (${r.accountLogin})` : r.accountLogin,
  }));
}

export async function getBusinessIntegrationBranch(businessId: string): Promise<string | null> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);
  const db = getDb();
  const row = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: { integrationBranch: true },
  });
  return row?.integrationBranch ?? null;
}

export async function addTaskRelation(
  businessId: string,
  fromTaskId: string,
  toTaskId: string,
  relationType: string,
): Promise<{ id: string }> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);
  const db = getDb();
  const [row] = await db
    .insert(taskRelations)
    .values({ businessId, fromTaskId, toTaskId, relationType })
    .returning({ id: taskRelations.id });
  if (!row) throw new Error("Failed to create relation");
  return row;
}

export async function removeTaskRelation(id: string): Promise<void> {
  const userId = await requireSessionUserId();
  const db = getDb();
  const rel = await db.query.taskRelations.findFirst({
    where: eq(taskRelations.id, id),
    columns: { businessId: true },
  });
  if (!rel) return;
  await assertUserBusinessAccess(userId, rel.businessId);
  await db.delete(taskRelations).where(eq(taskRelations.id, id));
}

export type TaskRelationRow = {
  id: string;
  relationType: string;
  linkedTaskId: string;
  linkedTaskTitle: string;
  linkedTaskStatus: string;
};

export async function getTaskRelations(
  taskId: string,
  businessId: string,
): Promise<TaskRelationRow[]> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);
  const db = getDb();

  const rows = await db.query.taskRelations.findMany({
    where: or(eq(taskRelations.fromTaskId, taskId), eq(taskRelations.toTaskId, taskId)),
  });

  const linkedIds = rows.map((r) => (r.fromTaskId === taskId ? r.toTaskId : r.fromTaskId));
  if (linkedIds.length === 0) return [];

  const linkedTasks = await db.query.tasks.findMany({
    where: inArray(tasks.id, linkedIds),
    columns: { id: true, title: true, status: true },
  });

  const taskMap = new Map(linkedTasks.map((t) => [t.id, t]));

  return rows.map((r) => {
    const linkedId = r.fromTaskId === taskId ? r.toTaskId : r.fromTaskId;
    const linked = taskMap.get(linkedId);
    return {
      id: r.id,
      relationType: r.relationType,
      linkedTaskId: linkedId,
      linkedTaskTitle: linked?.title ?? "(unknown)",
      linkedTaskStatus: linked?.status ?? "backlog",
    };
  });
}

export async function getRecentTasksForBusiness(
  businessId: string,
  limit = 50,
): Promise<{ id: string; title: string; status: string; priority: string | null; mission: string | null }[]> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);
  const db = getDb();
  const rows = await db.query.tasks.findMany({
    where: eq(tasks.businessId, businessId),
    columns: { id: true, title: true, status: true, priority: true, mission: true },
    orderBy: [desc(tasks.createdAt)],
    limit,
  });
  return rows;
}

function buildTree(rows: TaskRow[]): TaskTreeNode[] {
  const map = new Map<string, TaskTreeNode>();
  for (const r of rows) {
    map.set(r.id, { ...r, children: [] });
  }

  const roots: TaskTreeNode[] = [];
  for (const r of rows) {
    const node = map.get(r.id)!;
    const pid = r.parentTaskId;
    if (pid && map.has(pid)) {
      map.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
