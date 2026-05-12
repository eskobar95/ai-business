"use server";

import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { extractFirstJsonObject } from "@/lib/grill-me/extract-json-from-model";
import { mergeGrillMeReasoningAgentOptions } from "@/lib/grill-me/grill-cursor-runtime";
import type { GrillBusinessType } from "@/lib/grill-me/grill-prompt";
import {
  coerceGrillReasoningContext,
  minimalFallbackReasoningContext,
  type GrillReasoningContext,
} from "@/lib/grill-me/grill-reasoning-types";
import { buildReasoningEngineUserPrompt } from "@/lib/grill-me/reasoning-prompt";
import {
  fetchPublicRepoSnapshot,
  formatRepoSnapshotForReasoning,
} from "@/lib/grill-me/github-repo-snapshot";
import { auth } from "@/lib/auth/server";
import { getDb } from "@/db/index";
import { businesses, githubInstallations } from "@/db/schema";
import { runCursorAgent } from "@/lib/cursor/agent";
import { getUserCursorApiKeyDecrypted } from "@/lib/settings/cursor-api-key";
import { eq } from "drizzle-orm";

async function collectStream(iterable: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const chunk of iterable) out += chunk;
  return out;
}

async function persistReasoningSnapshot(
  businessId: string,
  ctx: GrillReasoningContext,
  error: string | null,
): Promise<void> {
  const db = getDb();
  await db
    .update(businesses)
    .set({
      grillReasoningContext: ctx,
      grillReasoningLastError: error,
      grillReasoningUpdatedAt: new Date(),
    })
    .where(eq(businesses.id, businessId));
}

/**
 * Prompt 1: silent reasoning over wizard fields (+ optional GitHub snapshot).
 * Persists structured JSON on `businesses.grill_reasoning_context` (or deterministic fallback).
 */
export async function runGrillReasoningPhase(
  businessId: string,
  businessType: GrillBusinessType,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    await assertUserBusinessAccess(userId, businessId);
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const db = getDb();
  const row = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
  });
  if (!row) return { ok: false, error: "Business not found" };

  const fallback = minimalFallbackReasoningContext(
    businessType,
    row.name,
    row.description,
  );

  // Resolve active repo: selectedRepos from GitHub installation first, then businesses.github_repo_url.
  let activeRepoUrl: string | null = row.githubRepoUrl?.trim() ?? null;
  const installation = await db.query.githubInstallations.findFirst({
    where: eq(githubInstallations.businessId, businessId),
    columns: { selectedRepos: true, repos: true },
  });
  if (installation) {
    const active = installation.selectedRepos ?? installation.repos ?? [];
    if (active.length > 0) {
      activeRepoUrl = `https://github.com/${active[0]}`;
    }
  }

  let githubText = "";
  if (activeRepoUrl) {
    const snap = await fetchPublicRepoSnapshot(activeRepoUrl);
    githubText = formatRepoSnapshotForReasoning(snap);
  }

  const prompt = buildReasoningEngineUserPrompt({
    businessName: row.name,
    businessDescription: row.description ?? "",
    businessType,
    githubRepoUrl: activeRepoUrl,
    githubAnalysisText: githubText,
  });

  const cursorApiKey = await getUserCursorApiKeyDecrypted();

  let raw = "";
  try {
    const stream = await runCursorAgent(prompt, mergeGrillMeReasoningAgentOptions(cursorApiKey));
    raw = (await collectStream(stream)).trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Reasoning model failed";
    await persistReasoningSnapshot(businessId, fallback, msg);
    return { ok: true };
  }

  const json = extractFirstJsonObject(raw);
  if (!json) {
    await persistReasoningSnapshot(
      businessId,
      fallback,
      "Reasoning output was not valid JSON — using fallback gap list",
    );
    return { ok: true };
  }

  const coerced = coerceGrillReasoningContext(json);
  if (!coerced) {
    await persistReasoningSnapshot(
      businessId,
      fallback,
      "Reasoning JSON failed validation — using fallback gap list",
    );
    return { ok: true };
  }

  await persistReasoningSnapshot(businessId, coerced, null);
  return { ok: true };
}
