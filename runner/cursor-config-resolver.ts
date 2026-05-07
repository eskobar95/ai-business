import { getDb } from "@/db/index";
import { agents, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";

const PLATFORM_DEFAULT_MODEL = "composer-2";
const PLATFORM_DEFAULT_EFFORT = "auto";

export interface ResolvedCursorConfig {
  /** Undefined means: don't pass model to SDK (let Cursor choose). */
  modelId: string | undefined;
  /** Undefined means: don't pass thinkingEffort to SDK. */
  thinkingEffort: string | undefined;
}

function resolveValue(
  agentVal: string | null | undefined,
  businessVal: string | null | undefined,
  platformDefault: string,
): string | undefined {
  if (!agentVal || agentVal === "auto") return undefined;
  if (agentVal === "inherit") {
    const biz = businessVal?.trim();
    if (biz && biz !== "auto" && biz !== "inherit") return biz;
    return platformDefault === "auto" ? undefined : platformDefault;
  }
  return agentVal;
}

/**
 * Resolves Cursor SDK config for an agent run.
 *
 * Semantics:
 *   'auto'    → send nothing to SDK (Cursor default)
 *   'inherit' → use business default → platform default
 *   <slug>    → use directly
 */
export async function resolveCursorConfig(
  agentId: string,
  businessId: string,
): Promise<ResolvedCursorConfig> {
  const db = getDb();

  const [agent, business] = await Promise.all([
    db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      columns: { cursorModelId: true, cursorThinkingEffort: true },
    }),
    db.query.businesses.findFirst({
      where: eq(businesses.id, businessId),
      columns: { defaultCursorModelId: true, defaultCursorThinkingEffort: true },
    }),
  ]);

  return {
    modelId: resolveValue(
      agent?.cursorModelId,
      business?.defaultCursorModelId,
      PLATFORM_DEFAULT_MODEL,
    ),
    thinkingEffort: resolveValue(
      agent?.cursorThinkingEffort,
      business?.defaultCursorThinkingEffort,
      PLATFORM_DEFAULT_EFFORT,
    ),
  };
}
