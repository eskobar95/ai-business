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
    where: and(
      eq(memory.id, memoryId),
      isNull(memory.agentId),
      eq(memory.scope, "business"),
    ),
    columns: {
      id: true,
      businessId: true,
      version: true,
    },
  });

  if (!row) {
    throw new Error("Memory section not found.");
  }

  await assertUserBusinessAccess(userId, row.businessId);

  const [updated] = await db
    .update(memory)
    .set({
      content,
      updatedAt: new Date(),
      version: row.version + 1,
    })
    .where(and(eq(memory.id, memoryId), eq(memory.version, row.version)))
    .returning({ id: memory.id });

  if (!updated) {
    throw new Error(
      "This memory section was updated elsewhere. Refresh the page and try again.",
    );
  }
}

/**
 * @param initialContent - Optional HTML body for Tiptap. Falsy or empty string uses `<p></p>`.
 */
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
