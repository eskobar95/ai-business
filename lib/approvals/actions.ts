"use server";

import { eq } from "drizzle-orm";

import { getDb } from "@/db/index";
import { approvals } from "@/db/schema";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { runEngineeringManagerDecomposition } from "@/lib/missions/em-decompose-action";
import { logAgentLifecycleStatus, logEvent } from "@/lib/orchestration/events";
import { requireSessionUserId } from "@/lib/roster/session";

export async function createApproval(params: {
  businessId: string;
  agentId?: string | null;
  artifactRef: Record<string, unknown>;
}): Promise<{ id: string }> {
  const userId = await requireSessionUserId();
  const { businessId, agentId, artifactRef } = params;
  if (!artifactRef || typeof artifactRef !== "object" || Array.isArray(artifactRef)) {
    throw new Error("artifactRef must be a plain object");
  }
  await assertUserBusinessAccess(userId, businessId);

  const db = getDb();
  const [row] = await db
    .insert(approvals)
    .values({
      businessId,
      agentId: agentId ?? null,
      artifactRef,
      approvalStatus: "pending",
    })
    .returning({ id: approvals.id });

  if (!row) throw new Error("Failed to create approval");

  await logEvent({
    type: "approval.created",
    businessId,
    payload: { approvalId: row.id, agentId: agentId ?? null, artifactRef },
    status: "succeeded",
    correlationKey: row.id,
  });

  if (agentId) {
    await logAgentLifecycleStatus(businessId, agentId, "awaiting_approval", {
      approvalId: row.id,
    });
  }

  return { id: row.id };
}

async function assertApprovalRowForUser(approvalId: string) {
  const userId = await requireSessionUserId();
  const db = getDb();
  const row = await db.query.approvals.findFirst({
    where: eq(approvals.id, approvalId),
  });
  if (!row?.businessId) throw new Error("Approval not found");
  await assertUserBusinessAccess(userId, row.businessId);
  return row;
}

export async function approveArtifact(approvalId: string, comment: string): Promise<void> {
  const row = await assertApprovalRowForUser(approvalId);
  if (row.approvalStatus !== "pending") {
    throw new Error("Approval is not pending");
  }

  const db = getDb();
  const trimmed = comment.trim();
  await db
    .update(approvals)
    .set({
      approvalStatus: "approved",
      comment: trimmed || null,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(approvals.id, approvalId));

  await logEvent({
    type: "approval.approved",
    businessId: row.businessId,
    payload: { approvalId, comment: trimmed || null },
    status: "succeeded",
    correlationKey: approvalId,
  });

  if (row.agentId && row.businessId) {
    await logAgentLifecycleStatus(row.businessId, row.agentId, "idle", { approvalId });
  }

  // Auto-trigger EM decomposition when a PO sprint brief is approved.
  const artifactRef = row.artifactRef as Record<string, unknown>;
  if (artifactRef?.artifactType === "po_sprint_brief" && row.businessId) {
    await runEngineeringManagerDecomposition(row.businessId, approvalId);
  }
}

export async function rejectArtifact(approvalId: string, comment: string): Promise<void> {
  const row = await assertApprovalRowForUser(approvalId);
  if (row.approvalStatus !== "pending") {
    throw new Error("Approval is not pending");
  }

  const db = getDb();
  const trimmed = comment.trim();
  await db
    .update(approvals)
    .set({
      approvalStatus: "rejected",
      comment: trimmed || null,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(approvals.id, approvalId));

  await logEvent({
    type: "approval.rejected",
    businessId: row.businessId,
    payload: { approvalId, comment: trimmed || null },
    status: "succeeded",
    correlationKey: approvalId,
  });

  if (row.agentId && row.businessId) {
    await logAgentLifecycleStatus(row.businessId, row.agentId, "idle", { approvalId });
  }
}

/**
 * Finds all approved PO sprint brief approvals for a business that have not yet
 * had EM decomposition run, and triggers it for each. Safe to call repeatedly —
 * `runEngineeringManagerDecomposition` is idempotent (skips if tasks already exist).
 */
export async function backfillApprovedSprintBriefs(businessId: string): Promise<void> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);

  const db = getDb();
  const rows = await db.query.approvals.findMany({
    where: eq(approvals.businessId, businessId),
    columns: { id: true, approvalStatus: true, artifactRef: true },
  });

  const pending = rows.filter((r) => {
    if (r.approvalStatus !== "approved") return false;
    const ref = r.artifactRef as Record<string, unknown>;
    return ref?.artifactType === "po_sprint_brief";
  });

  await Promise.allSettled(
    pending.map((r) => runEngineeringManagerDecomposition(businessId, r.id)),
  );
}
