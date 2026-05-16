import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/index";
import { agents } from "@/db/schema";

/**
 * Loads the `slug === "soul"` agent document for a roster agent (e.g. Enterprise template PO/EM).
 */
export async function loadAgentSoulMarkdown(
  businessId: string,
  agentSlug: string,
): Promise<string> {
  const db = getDb();
  const agentRow = await db.query.agents.findFirst({
    where: and(eq(agents.businessId, businessId), eq(agents.slug, agentSlug)),
    columns: { id: true },
    with: { documents: true },
  });
  const raw = agentRow?.documents.find((d) => d.slug === "soul")?.content;
  return typeof raw === "string" ? raw.trim() : "";
}
