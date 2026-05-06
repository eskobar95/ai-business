"use server";

import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { getDb } from "@/db/index";
import { memory } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireSessionUserId } from "@/lib/roster/session";

export async function updateMemoryContent(memoryId: string, content: string): Promise<void> {
  const userId = await requireSessionUserId();
  const db = getDb();

  const row = await db.query.memory.findFirst({
    where: and(eq(memory.id, memoryId), isNull(memory.agentId)),
    columns: {
      id: true,
      businessId: true,
      scope: true,
      version: true,
    },
  });

  if (!row) {
    throw new Error("Memory section not found.");
  }
  if (row.scope !== "business") {
    throw new Error("Only business memory can be edited here.");
  }

  await assertUserBusinessAccess(userId, row.businessId);

  await db
    .update(memory)
    .set({
      content,
      updatedAt: new Date(),
      version: row.version + 1,
    })
    .where(eq(memory.id, memoryId));
}

export async function createBusinessMemorySection(
  businessId: string,
  initialContent?: string,
): Promise<{ id: string }> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);

  const body = initialContent?.length ? initialContent : "<p></p>";

  const db = getDb();
  const [inserted] = await db
    .insert(memory)
    .values({
      businessId,
      agentId: null,
      scope: "business",
      content: body,
    })
    .returning({ id: memory.id });

  if (!inserted) {
    throw new Error("Could not create memory section.");
  }

  return { id: inserted.id };
}
