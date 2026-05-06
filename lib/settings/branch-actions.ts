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

const CURSOR_MODEL_IDS = [
  "auto",
  "claude-sonnet-4",
  "claude-opus-4",
  "gpt-4.1",
  "gemini-2.5-pro",
] as const;

const CURSOR_THINKING_EFFORTS = ["auto", "low", "medium", "high"] as const;

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
    !CURSOR_MODEL_IDS.includes(
      defaultCursorModelId as (typeof CURSOR_MODEL_IDS)[number],
    )
  ) {
    throw new Error("Invalid Cursor model selection.");
  }
  if (
    defaultCursorThinkingEffort !== null &&
    !CURSOR_THINKING_EFFORTS.includes(
      defaultCursorThinkingEffort as (typeof CURSOR_THINKING_EFFORTS)[number],
    )
  ) {
    throw new Error("Invalid Cursor thinking effort selection.");
  }

  const db = getDb();
  await db
    .update(businesses)
    .set({ defaultCursorModelId, defaultCursorThinkingEffort })
    .where(eq(businesses.id, businessId));
}
