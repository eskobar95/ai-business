import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db/index";
import { routines } from "@/db/schema";

export type RoutineRow = typeof routines.$inferSelect;

export async function listRoutinesByAgentId(agentId: string): Promise<RoutineRow[]> {
  const db = getDb();
  return db
    .select()
    .from(routines)
    .where(eq(routines.agentId, agentId))
    .orderBy(desc(routines.createdAt));
}
