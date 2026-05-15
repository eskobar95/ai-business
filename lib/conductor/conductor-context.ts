import { getDb } from "@/db/index";
import { agents, approvals, businesses, memory, missions } from "@/db/schema";
import { summarizeArtifactRef } from "@/lib/approvals/artifact-summary";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

export type ConductorOrchestrationSnapshot = {
  businessName: string;
  soulMarkdown: string;
  agentRosterText: string;
  activeMissionsText: string;
  pendingApprovalsCount: number;
  pendingApprovalTitlesText: string;
};

/**
 * Loads cross-roster context used to hydrate the Conductor instruction template
 * (soul memory, roster, initiatives, approvals).
 */
export async function loadConductorOrchestrationSnapshot(
  businessId: string,
): Promise<ConductorOrchestrationSnapshot> {
  const db = getDb();

  const [biz] = await db
    .select({ name: businesses.name })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  const soulRow = await db
    .select({ content: memory.content })
    .from(memory)
    .where(
      and(eq(memory.businessId, businessId), eq(memory.scope, "business"), isNull(memory.agentId)),
    )
    .orderBy(desc(memory.updatedAt))
    .limit(1);

  const roster = await db
    .select({ name: agents.name, role: agents.role, slug: agents.slug })
    .from(agents)
    .where(eq(agents.businessId, businessId))
    .orderBy(asc(agents.name));

  const missionRows = await db
    .select({ name: missions.name, status: missions.status })
    .from(missions)
    .where(eq(missions.businessId, businessId))
    .orderBy(desc(missions.updatedAt))
    .limit(25);

  const pending = await db
    .select({ id: approvals.id, artifactRef: approvals.artifactRef })
    .from(approvals)
    .where(and(eq(approvals.businessId, businessId), eq(approvals.approvalStatus, "pending")));

  const agentRosterText =
    roster.length === 0
      ? "(none)"
      : roster
          .map((a) => {
            const slug = typeof a.slug === "string" && a.slug.trim() ? ` (${a.slug})` : "";
            return `- **${a.name}**${slug} — ${a.role}`;
          })
          .join("\n");

  const activeMissionsText =
    missionRows.length === 0
      ? "(none)"
      : missionRows.map((p) => `- **${p.name}** — ${p.status}`).join("\n");

  const pendingApprovalTitlesText =
    pending.length === 0
      ? "(none)"
      : pending
          .map((row) => {
            const ref =
              row.artifactRef && typeof row.artifactRef === "object" && !Array.isArray(row.artifactRef)
                ? summarizeArtifactRef(row.artifactRef as Record<string, unknown>)
                : "(no reference)";
            return `- ${ref}`;
          })
          .join("\n");

  return {
    businessName: biz?.name?.trim() || "Business",
    soulMarkdown: soulRow[0]?.content?.trim() || "(no business memory yet)",
    agentRosterText,
    activeMissionsText,
    pendingApprovalsCount: pending.length,
    pendingApprovalTitlesText,
  };
}

/** Replaces bracket placeholders in the Conductor instruction markdown. */
export function applyConductorInstructionPlaceholders(
  template: string,
  snap: ConductorOrchestrationSnapshot,
): string {
  return template
    .replaceAll("[BUSINESS_NAME]", snap.businessName)
    .replaceAll("[SOUL_MARKDOWN]", snap.soulMarkdown)
    .replaceAll("[AGENT_ROSTER]", snap.agentRosterText)
    .replaceAll("[ACTIVE_MISSIONS]", snap.activeMissionsText)
    .replaceAll("[APPROVALS_COUNT]", String(snap.pendingApprovalsCount))
    .replaceAll("[APPROVAL_TITLES]", snap.pendingApprovalTitlesText);
}
