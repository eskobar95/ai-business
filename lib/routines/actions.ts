"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/index";
import { agents, routines } from "@/db/schema";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { requireSessionUserId } from "@/lib/roster/session";
import type { RoutineRow } from "@/lib/routines/queries";

const cronField = z
  .string()
  .min(1)
  .refine((s) => {
    const parts = s.trim().split(/\s+/);
    return parts.length === 5;
  }, "Cron must have 5 fields (minute hour day month weekday)");

const RoutineCreateSchema = z.object({
  businessId: z.string().uuid(),
  agentId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  cronExpression: cronField,
  humanSchedule: z.string().min(1),
  prompt: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

const RoutineUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  cronExpression: cronField.optional(),
  humanSchedule: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

async function assertAgentInBusiness(businessId: string, agentId: string): Promise<void> {
  const db = getDb();
  const row = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    columns: { businessId: true },
  });
  if (!row || row.businessId !== businessId) {
    throw new Error("Agent not found in this workspace.");
  }
}

async function assertRoutineRow(routineId: string): Promise<RoutineRow> {
  const db = getDb();
  const row = await db.query.routines.findFirst({
    where: eq(routines.id, routineId),
  });
  if (!row) throw new Error("Routine not found.");
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, row.businessId);
  return row;
}

function revalidateAgentPages(agentId: string): void {
  revalidatePath(`/dashboard/agents/${agentId}`);
}

export async function createRoutine(
  input: z.infer<typeof RoutineCreateSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const parsed = RoutineCreateSchema.parse(input);
    const userId = await requireSessionUserId();
    await assertUserBusinessAccess(userId, parsed.businessId);
    await assertAgentInBusiness(parsed.businessId, parsed.agentId);

    const db = getDb();
    const [row] = await db
      .insert(routines)
      .values({
        businessId: parsed.businessId,
        agentId: parsed.agentId,
        name: parsed.name.trim(),
        description: parsed.description?.trim() || null,
        cronExpression: parsed.cronExpression.trim(),
        humanSchedule: parsed.humanSchedule.trim(),
        prompt: parsed.prompt.trim(),
        isActive: parsed.isActive ?? true,
        // TODO: Compute `next_run_at` from cron when scheduler lands; then POST /agent/spawn at due time.
        nextRunAt: null,
      })
      .returning({ id: routines.id });

    if (!row) throw new Error("Insert failed");
    revalidateAgentPages(parsed.agentId);
    return { ok: true, id: row.id };
  } catch (e) {
    const msg =
      e instanceof z.ZodError ? e.issues.map((x) => x.message).join("; ") : (e as Error).message;
    return { ok: false, error: msg };
  }
}

export async function updateRoutine(
  input: z.infer<typeof RoutineUpdateSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = RoutineUpdateSchema.parse(input);
    const { id, ...rest } = parsed;
    const existing = await assertRoutineRow(id);

    const updates: Partial<typeof routines.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (rest.name != null) updates.name = rest.name.trim();
    if (rest.description !== undefined) updates.description = rest.description?.trim() || null;
    if (rest.cronExpression != null) updates.cronExpression = rest.cronExpression.trim();
    if (rest.humanSchedule != null) updates.humanSchedule = rest.humanSchedule.trim();
    if (rest.prompt != null) updates.prompt = rest.prompt.trim();
    if (rest.isActive != null) updates.isActive = rest.isActive;

    const db = getDb();
    await db.update(routines).set(updates).where(eq(routines.id, id));

    revalidateAgentPages(existing.agentId);
    return { ok: true };
  } catch (e) {
    const msg =
      e instanceof z.ZodError ? e.issues.map((x) => x.message).join("; ") : (e as Error).message;
    return { ok: false, error: msg };
  }
}

export async function deleteRoutine(
  routineId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const existing = await assertRoutineRow(routineId);
    const db = getDb();
    await db.delete(routines).where(eq(routines.id, routineId));
    revalidateAgentPages(existing.agentId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
}
