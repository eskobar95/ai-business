"use server";

import { getDb } from "@/db/index";
import { taskLogs, tasks } from "@/db/schema";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { requireSessionUserId } from "@/lib/roster/session";
import { asc, eq } from "drizzle-orm";

import { routeCommentToAgents } from "./mention-trigger";

export type TaskLogAuthorType = "agent" | "human";

async function assertTaskAccess(taskId: string) {
  const userId = await requireSessionUserId();
  const db = getDb();
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    columns: { businessId: true },
  });
  if (!task) throw new Error("Task not found");
  await assertUserBusinessAccess(userId, task.businessId);
  return task;
}

export async function appendTaskLog(
  taskId: string,
  content: string,
  authorType: TaskLogAuthorType,
  authorId: string,
): Promise<{ id: string }> {
  await assertTaskAccess(taskId);

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Log content is required");

  const db = getDb();
  const [row] = await db
    .insert(taskLogs)
    .values({
      taskId,
      authorType,
      authorId: authorId.trim(),
      content: trimmed,
    })
    .returning({ id: taskLogs.id });

  if (!row) throw new Error("Failed to append task log");

  if (authorType === "human") {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      columns: { businessId: true, agentId: true },
    });
    if (task) {
      await routeCommentToAgents(taskId, trimmed, task.businessId, task.agentId ?? null);
    }
  }

  return row;
}

export async function getTaskLogs(taskId: string) {
  await assertTaskAccess(taskId);
  const db = getDb();
  return db.query.taskLogs.findMany({
    where: eq(taskLogs.taskId, taskId),
    orderBy: [asc(taskLogs.createdAt)],
  });
}
