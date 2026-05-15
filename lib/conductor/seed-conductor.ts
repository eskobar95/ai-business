import { getDb } from "@/db/index";
import { agentDocuments, agents } from "@/db/schema";
import { CONDUCTOR_INSTRUCTION_TEMPLATE } from "@/lib/conductor/conductor-instruction-template";
import { and, eq } from "drizzle-orm";

/**
 * Ensures each business has a Conductor roster entry (`slug=conductor`) with default documents.
 * Idempotent: safe to call after business creation and as a one-off for existing tenants.
 */
export async function seedConductorAgent(businessId: string): Promise<void> {
  const db = getDb();
  const template = CONDUCTOR_INSTRUCTION_TEMPLATE.trim();

  const inserted = await db
    .insert(agents)
    .values({
      businessId,
      name: "Conductor",
      slug: "conductor",
      role: "Platform orchestrator",
      isPlatformDefault: true,
    })
    .onConflictDoNothing({ target: [agents.businessId, agents.slug] })
    .returning({ id: agents.id });

  const newId = inserted[0]?.id;
  const existingRow =
    newId == null
      ? await db.query.agents.findFirst({
          where: and(eq(agents.businessId, businessId), eq(agents.slug, "conductor")),
          columns: { id: true },
        })
      : null;
  const conductorAgentId = newId ?? existingRow?.id;
  if (!conductorAgentId) {
    return;
  }

  await db
    .update(agents)
    .set({ isPlatformDefault: true })
    .where(and(eq(agents.id, conductorAgentId), eq(agents.businessId, businessId)));

  const soul = await db.query.agentDocuments.findFirst({
    where: and(eq(agentDocuments.agentId, conductorAgentId), eq(agentDocuments.slug, "soul")),
    columns: { id: true },
  });

  if (!soul) {
    await db.insert(agentDocuments).values([
      {
        agentId: conductorAgentId,
        slug: "soul",
        filename: "soul.md",
        content: template,
      },
      {
        agentId: conductorAgentId,
        slug: "tools",
        filename: "tools.md",
        content: "",
      },
      {
        agentId: conductorAgentId,
        slug: "heartbeat",
        filename: "heartbeat.md",
        content: "",
      },
    ]);
  }
}
