"use server";

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db/index";
import { missions, sprints } from "@/db/schema";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { requireSessionUserId } from "@/lib/roster/session";

async function assertMissionAccessForSprint(missionId: string): Promise<void> {
  const userId = await requireSessionUserId();
  const db = getDb();
  const m = await db.query.missions.findFirst({
    where: eq(missions.id, missionId),
    columns: { businessId: true },
  });
  if (!m) throw new Error("Mission not found");
  await assertUserBusinessAccess(userId, m.businessId);
}

async function assertSprintAccess(sprintId: string): Promise<string> {
  const userId = await requireSessionUserId();
  const db = getDb();
  const sp = await db.query.sprints.findFirst({
    where: eq(sprints.id, sprintId),
    columns: { missionId: true },
    with: {
      mission: { columns: { businessId: true } },
    },
  });
  if (!sp?.mission) throw new Error("Sprint not found");
  await assertUserBusinessAccess(userId, sp.mission.businessId);
  return sp.missionId;
}

export async function createSprint(missionId: string, data: { name: string; goal?: string }) {
  await assertMissionAccessForSprint(missionId);
  const nm = data.name.trim();
  if (!nm) throw new Error("Sprint name is required");
  const db = getDb();
  const [row] = await db
    .insert(sprints)
    .values({
      missionId,
      name: nm,
      goal: data.goal?.trim() || null,
    })
    .returning({ id: sprints.id });
  if (!row) throw new Error("Failed to create sprint");
  return row;
}

export async function updateSprint(
  sprintId: string,
  patch: Partial<{
    name: string;
    goal: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
  }>,
): Promise<void> {
  await assertSprintAccess(sprintId);
  const db = getDb();
  const payload: Partial<typeof sprints.$inferInsert> = {};
  if (patch.name !== undefined) {
    const nm = patch.name.trim();
    if (!nm) throw new Error("Sprint name is required");
    payload.name = nm;
  }
  if (patch.goal !== undefined) payload.goal = patch.goal;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.startDate !== undefined) payload.startDate = patch.startDate;
  if (patch.endDate !== undefined) payload.endDate = patch.endDate;
  await db.update(sprints).set(payload).where(eq(sprints.id, sprintId));
}

export async function deleteSprint(sprintId: string): Promise<void> {
  await assertSprintAccess(sprintId);
  const db = getDb();
  await db.delete(sprints).where(eq(sprints.id, sprintId));
}

/**
 * Sets one sprint `active`; other sprints on the mission become `planning` (unless `completed`).
 * Uses a single SQL statement so both updates are atomic on Neon HTTP (no `db.transaction()`).
 */
export async function activateSprint(sprintId: string): Promise<void> {
  const missionId = await assertSprintAccess(sprintId);
  const db = getDb();
  await db.execute(sql`
    WITH _ AS (
      UPDATE sprints
      SET status = 'planning'
      WHERE mission_id = ${missionId}
        AND id != ${sprintId}
        AND status != 'completed'
    )
    UPDATE sprints
    SET status = 'active'
    WHERE id = ${sprintId}
  `);
}
