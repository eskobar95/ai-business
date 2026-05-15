"use server";

import { count, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/index";
import { missions, approvals, sprints, tasks } from "@/db/schema";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { requireSessionUserId } from "@/lib/roster/session";

async function ensureBusiness(businessId: string): Promise<void> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);
}

export async function createMission(params: {
  businessId: string;
  name: string;
  prd?: string;
  status?: "draft" | "active" | "completed" | "archived";
}): Promise<{ id: string }> {
  await ensureBusiness(params.businessId);
  const db = getDb();
  const nm = params.name.trim();
  if (!nm) throw new Error("Mission name is required");

  const [row] = await db
    .insert(missions)
    .values({
      businessId: params.businessId,
      name: nm,
      prd: params.prd ?? "",
      status: params.status ?? "draft",
      updatedAt: new Date(),
    })
    .returning({ id: missions.id });
  if (!row) throw new Error("Failed to create mission");
  return row;
}

export async function updateMission(
  missionId: string,
  patch: Partial<{
    name: string;
    prd: string;
    status: string;
    notionId: string | null;
  }>,
): Promise<void> {
  const userId = await requireSessionUserId();
  const db = getDb();
  const existing = await db.query.missions.findFirst({
    where: eq(missions.id, missionId),
    columns: { businessId: true },
  });
  if (!existing) throw new Error("Mission not found");
  await assertUserBusinessAccess(userId, existing.businessId);

  const payload: Partial<typeof missions.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) {
    const nm = patch.name.trim();
    if (!nm) throw new Error("Mission name is required");
    payload.name = nm;
  }
  if (patch.prd !== undefined) payload.prd = patch.prd;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.notionId !== undefined) payload.notionId = patch.notionId;

  await db.update(missions).set(payload).where(eq(missions.id, missionId));
}

export async function deleteMission(missionId: string): Promise<void> {
  const userId = await requireSessionUserId();
  const db = getDb();
  const existing = await db.query.missions.findFirst({
    where: eq(missions.id, missionId),
    columns: { businessId: true },
  });
  if (!existing) throw new Error("Mission not found");
  await assertUserBusinessAccess(userId, existing.businessId);
  await db.delete(missions).where(eq(missions.id, missionId));
}

export async function listMissionsOverview(businessId: string) {
  await ensureBusiness(businessId);
  const db = getDb();
  const rows = await db
    .select()
    .from(missions)
    .where(eq(missions.businessId, businessId))
    .orderBy(desc(missions.updatedAt));

  if (rows.length === 0) return rows.map((r) => ({ ...r, sprintCount: 0, taskCount: 0 }));

  const ids = rows.map((r) => r.id);
  const sprintRows = await db
    .select({ missionId: sprints.missionId, n: count() })
    .from(sprints)
    .where(inArray(sprints.missionId, ids))
    .groupBy(sprints.missionId);
  const sprintMap = new Map(sprintRows.map((s) => [s.missionId, Number(s.n)]));

  const taskRows = await db
    .select({ missionId: tasks.missionId, n: count() })
    .from(tasks)
    .where(inArray(tasks.missionId, ids))
    .groupBy(tasks.missionId);
  const taskMap = new Map(
    taskRows.filter((t) => t.missionId != null).map((t) => [t.missionId!, Number(t.n)]),
  );

  return rows.map((r) => ({
    ...r,
    sprintCount: sprintMap.get(r.id) ?? 0,
    taskCount: taskMap.get(r.id) ?? 0,
  }));
}

function approvalReferencesMission(ref: Record<string, unknown>, missionId: string): boolean {
  if (ref?.kind === "mission" && ref?.missionId === missionId) return true;
  /** Legacy artifact refs from before rename */
  if (ref?.kind === "project" && ref?.projectId === missionId) return true;
  return false;
}

export async function getMissionBundle(missionId: string) {
  const userId = await requireSessionUserId();
  const db = getDb();
  const mission = await db.query.missions.findFirst({
    where: eq(missions.id, missionId),
    with: {
      sprintsMany: {
        orderBy: (sp, { asc }) => [asc(sp.createdAt)],
      },
    },
  });
  if (!mission) throw new Error("Mission not found");
  await assertUserBusinessAccess(userId, mission.businessId);

  const taskRows = await db.query.tasks.findMany({
    where: eq(tasks.missionId, missionId),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
    columns: {
      id: true,
      title: true,
      status: true,
      sprintId: true,
      priority: true,
      storyPoints: true,
    },
  });

  const approvalsAll = await db.query.approvals.findMany({
    where: eq(approvals.businessId, mission.businessId),
    orderBy: (a, { desc: d }) => [d(a.createdAt)],
    limit: 120,
    columns: {
      id: true,
      artifactRef: true,
      approvalStatus: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      agentId: true,
      businessId: true,
      decidedAt: true,
    },
  });
  const approvalsRows = approvalsAll.filter((a) => {
    const ref = a.artifactRef as Record<string, unknown>;
    return approvalReferencesMission(ref, missionId);
  });

  return { mission, tasks: taskRows, approvals: approvalsRows };
}
