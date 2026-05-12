"use server";

import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { getDb } from "@/db/index";
import { agentDocuments, agents, teams } from "@/db/schema";
import { requireSessionUserId } from "@/lib/roster/session";
import { and, asc, eq } from "drizzle-orm";

import type { AgentCommunicationCanvasRow } from "@/lib/agents/communication-canvas";

import { validateReportsToForBusiness } from "./reports-cycle";

import { resolveAvatarColumnsForUpsert } from "@/lib/agents/avatar-upsert";
import { assertValidAgentCursorPatchFields } from "@/lib/agents/cursor-agent-config";

/** Columns persisted on `agents` (no legacy `instructions` column; soul is in `agent_documents`). */
const agentsPublicColumns = {
  id: true,
  businessId: true,
  archetypeId: true,
  systemRoleId: true,
  name: true,
  slug: true,
  role: true,
  executionAdapter: true,
  modelRouting: true,
  tier: true,
  avatarUrl: true,
  iconKey: true,
  reportsToAgentId: true,
  cursorModelId: true,
  cursorThinkingEffort: true,
  cursorRuntimeProfile: true,
  heartbeatPromotionCap: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Agent row with soul markdown exposed as `instructions` for existing UI contracts. */
export type AgentWithInstructions = typeof agents.$inferSelect & {
  instructions: string;
};

async function ensureBusinessMembership(businessId: string): Promise<void> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);
}

export async function assertUserOwnsAgent(agentId: string): Promise<{
  userId: string;
  businessId: string;
}> {
  const db = getDb();
  const userId = await requireSessionUserId();
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    columns: { businessId: true },
  });
  if (!agent) throw new Error("Forbidden");
  await assertUserBusinessAccess(userId, agent.businessId);
  return { userId, businessId: agent.businessId };
}

export async function createAgent(params: {
  businessId: string;
  name: string;
  role: string;
  instructions: string;
  reportsToAgentId?: string | null;
}) {
  const { businessId, name, role, instructions, reportsToAgentId } = params;
  const trimmedName = name.trim();
  const trimmedRole = role.trim();
  const trimmedInstructions = instructions.trim();
  if (!trimmedName) throw new Error("Agent name is required");
  if (!trimmedRole) throw new Error("Agent role is required");
  if (!trimmedInstructions) throw new Error("Instructions are required");

  await ensureBusinessMembership(businessId);
  const db = getDb();
  const validatedReports = await validateReportsToForBusiness(
    businessId,
    null,
    reportsToAgentId,
  );

  // Neon HTTP driver (`drizzle-orm/neon-http`) does not support `db.transaction()`.
  const [agentRow] = await db
    .insert(agents)
    .values({
      businessId,
      name: trimmedName,
      role: trimmedRole,
      reportsToAgentId: validatedReports,
    })
    .returning();

  if (!agentRow) throw new Error("Failed to create agent");

  try {
    await db.insert(agentDocuments).values([
      {
        agentId: agentRow.id,
        slug: "soul",
        filename: "soul.md",
        content: trimmedInstructions,
      },
      {
        agentId: agentRow.id,
        slug: "tools",
        filename: "tools.md",
        content: "",
      },
      {
        agentId: agentRow.id,
        slug: "heartbeat",
        filename: "heartbeat.md",
        content: "",
      },
    ]);
  } catch (err) {
    await db.delete(agents).where(eq(agents.id, agentRow.id));
    throw err;
  }

  return { ...agentRow, instructions: trimmedInstructions };
}

export async function updateAgent(
  agentId: string,
  patch: Partial<
    Pick<
      typeof agents.$inferSelect,
      | "name"
      | "role"
      | "reportsToAgentId"
      | "systemRoleId"
      | "cursorModelId"
      | "cursorThinkingEffort"
      | "cursorRuntimeProfile"
      | "heartbeatPromotionCap"
      | "avatarUrl"
      | "iconKey"
    > & {
      instructions?: string;
    }
  >,
) {
  await assertUserOwnsAgent(agentId);

  const db = getDb();
  const existing = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    columns: { businessId: true },
  });
  if (!existing) throw new Error("Agent not found");

  const payload: Partial<typeof agents.$inferInsert> = {};

  if (patch.name !== undefined) {
    const nm = patch.name.trim();
    if (!nm) throw new Error("Agent name is required");
    payload.name = nm;
  }
  if (patch.role !== undefined) {
    const rl = patch.role.trim();
    if (!rl) throw new Error("Agent role is required");
    payload.role = rl;
  }
  if (patch.reportsToAgentId !== undefined) {
    const validated = await validateReportsToForBusiness(
      existing.businessId,
      agentId,
      patch.reportsToAgentId ?? null,
    );
    payload.reportsToAgentId = validated;
  }
  if (patch.systemRoleId !== undefined) {
    payload.systemRoleId = patch.systemRoleId;
  }

  assertValidAgentCursorPatchFields({
    cursorModelId: patch.cursorModelId,
    cursorThinkingEffort: patch.cursorThinkingEffort,
    heartbeatPromotionCap: patch.heartbeatPromotionCap,
  });

  if (patch.cursorModelId !== undefined) {
    payload.cursorModelId = patch.cursorModelId;
  }
  if (patch.cursorThinkingEffort !== undefined) {
    payload.cursorThinkingEffort = patch.cursorThinkingEffort;
  }
  if (patch.cursorRuntimeProfile !== undefined) {
    const profile = patch.cursorRuntimeProfile.trim();
    if (!profile) throw new Error("cursorRuntimeProfile cannot be empty");
    payload.cursorRuntimeProfile = profile;
  }
  if (patch.heartbeatPromotionCap !== undefined) {
    payload.heartbeatPromotionCap = patch.heartbeatPromotionCap;
  }

  let mergedAvatarFields = false;
  if (patch.avatarUrl !== undefined || patch.iconKey !== undefined) {
    const avatarCols = resolveAvatarColumnsForUpsert({
      avatarUrl: patch.avatarUrl,
      iconKey: patch.iconKey,
    });
    if (avatarCols) {
      Object.assign(payload, avatarCols);
      mergedAvatarFields = true;
    }
  }

  const shouldPatchAgentRow =
    patch.name !== undefined ||
    patch.role !== undefined ||
    patch.reportsToAgentId !== undefined ||
    patch.systemRoleId !== undefined ||
    patch.cursorModelId !== undefined ||
    patch.cursorThinkingEffort !== undefined ||
    patch.cursorRuntimeProfile !== undefined ||
    patch.heartbeatPromotionCap !== undefined ||
    mergedAvatarFields;

  // Neon HTTP driver does not support `db.transaction()`; run steps sequentially.
  if (patch.instructions !== undefined) {
    const ins = patch.instructions.trim();
    if (!ins) throw new Error("Instructions are required");
    await db
      .update(agentDocuments)
      .set({ content: ins, updatedAt: new Date() })
      .where(and(eq(agentDocuments.agentId, agentId), eq(agentDocuments.slug, "soul")));
  }

  let updated: typeof agents.$inferSelect | undefined;
  if (shouldPatchAgentRow) {
    payload.updatedAt = new Date();
    const rows = await db.update(agents).set(payload).where(eq(agents.id, agentId)).returning();
    updated = rows[0];
  } else {
    updated = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      columns: agentsPublicColumns,
    });
  }

  if (!updated) throw new Error("Agent not found");

  const soulRows = await db.query.agentDocuments.findMany({
    where: and(eq(agentDocuments.agentId, agentId), eq(agentDocuments.slug, "soul")),
    columns: { content: true },
  });
  const soulContent = soulRows[0]?.content ?? "";

  return { ...updated, instructions: soulContent };
}

/** Updates persisted avatar URL and/or roster icon picker key (both optional). */
export async function updateAgentAvatar(
  agentId: string,
  patch: { avatarUrl?: string | null; iconKey?: string | null },
): Promise<void> {
  const inner: Parameters<typeof updateAgent>[1] = {};
  if (patch.avatarUrl !== undefined) inner.avatarUrl = patch.avatarUrl;
  if (patch.iconKey !== undefined) inner.iconKey = patch.iconKey;
  if (Object.keys(inner).length === 0) return;
  await updateAgent(agentId, inner);
}

export async function deleteAgent(agentId: string): Promise<void> {
  await assertUserOwnsAgent(agentId);
  const db = getDb();

  const blockingTeam = await db.query.teams.findFirst({
    where: eq(teams.leadAgentId, agentId),
    columns: { id: true, name: true },
  });
  if (blockingTeam) {
    throw new Error(
      `Cannot delete agent while they are lead of team "${blockingTeam.name}". Reassign lead first.`,
    );
  }

  await db.delete(agents).where(eq(agents.id, agentId));
}

export async function listAgentSummariesByBusiness(
  businessId: string,
): Promise<{ id: string; name: string }[]> {
  await ensureBusinessMembership(businessId);
  const db = getDb();
  return db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(eq(agents.businessId, businessId))
    .orderBy(asc(agents.name));
}

/**
 * Lists agents for the communication canvas graph (no soul/instructions fetch).
 */
export async function listAgentsForCommunicationCanvas(
  businessId: string,
): Promise<AgentCommunicationCanvasRow[]> {
  await ensureBusinessMembership(businessId);
  const db = getDb();
  return db
    .select({
      id: agents.id,
      slug: agents.slug,
      name: agents.name,
      role: agents.role,
      tier: agents.tier,
      avatarUrl: agents.avatarUrl,
      iconKey: agents.iconKey,
    })
    .from(agents)
    .where(eq(agents.businessId, businessId))
    .orderBy(asc(agents.name));
}

export async function getAgentsByBusiness(businessId: string): Promise<AgentWithInstructions[]> {
  await ensureBusinessMembership(businessId);
  const db = getDb();
  const rows = await db.query.agents.findMany({
    where: eq(agents.businessId, businessId),
    orderBy: [asc(agents.name)],
    columns: agentsPublicColumns,
    with: {
      documents: {
        where: eq(agentDocuments.slug, "soul"),
        columns: { slug: true, content: true },
      },
    },
  });

  return rows.map((r) => {
    const soulContent = r.documents.find((d) => d.slug === "soul")?.content ?? "";
    const { documents: _documents, ...agent } = r;
    return { ...agent, instructions: soulContent };
  });
}
