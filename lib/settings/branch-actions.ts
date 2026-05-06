"use server";

import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { getDb } from "@/db/index";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSessionUserId } from "@/lib/roster/session";

import {
  assertValidOptionalBranchField,
  normalizeBranchValue,
} from "@/lib/settings/branch-validation";
import {
  isAllowedWorkspaceCursorModelId,
  isAllowedWorkspaceThinkingEffort,
} from "@/lib/settings/cursor-workspace-defaults";

export async function updateBusinessBranchSettings(
  businessId: string,
  input: { integrationBranch: string | null; releaseBranch: string | null },
): Promise<void> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);

  const integrationBranch = normalizeBranchValue(input.integrationBranch);
  const releaseBranch = normalizeBranchValue(input.releaseBranch);

  if (integrationBranch === null) {
    throw new Error("Integration branch is required.");
  }

  assertValidOptionalBranchField("Integration branch", integrationBranch);
  assertValidOptionalBranchField("Release branch", releaseBranch);

  const db = getDb();
  await db
    .update(businesses)
    .set({ integrationBranch, releaseBranch })
    .where(eq(businesses.id, businessId));
}

export async function updateBusinessParallelSettings(
  businessId: string,
  input: { maxParallelRuns: number | null },
): Promise<void> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);

  const { maxParallelRuns } = input;
  if (maxParallelRuns !== null) {
    if (!Number.isInteger(maxParallelRuns) || maxParallelRuns < 1) {
      throw new Error("Max parallel runs must be null or an integer ≥ 1.");
    }
  }

  const db = getDb();
  await db
    .update(businesses)
    .set({ maxParallelRuns })
    .where(eq(businesses.id, businessId));
}

export async function updateBusinessCursorDefaults(
  businessId: string,
  input: { defaultCursorModelId: string | null; defaultCursorThinkingEffort: string | null },
): Promise<void> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);

  const defaultCursorModelId = input.defaultCursorModelId?.trim() || null;
  const defaultCursorThinkingEffort = input.defaultCursorThinkingEffort?.trim() || null;

  if (
    defaultCursorModelId !== null &&
    !isAllowedWorkspaceCursorModelId(defaultCursorModelId)
  ) {
    throw new Error("Invalid Cursor model selection.");
  }
  if (
    defaultCursorThinkingEffort !== null &&
    !isAllowedWorkspaceThinkingEffort(defaultCursorThinkingEffort)
  ) {
    throw new Error("Invalid Cursor thinking effort selection.");
  }

  const db = getDb();
  await db
    .update(businesses)
    .set({ defaultCursorModelId, defaultCursorThinkingEffort })
    .where(eq(businesses.id, businessId));
}
