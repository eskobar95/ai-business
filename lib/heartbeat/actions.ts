"use server";

import { assertUserOwnsAgent } from "@/lib/agents/actions";
import { getDb } from "@/db/index";
import { agents, businesses, orchestrationEvents, systemRoles } from "@/db/schema";
import { getUserCursorApiKeyDecrypted } from "@/lib/settings/cursor-api-key";
import { Agent } from "@cursor/sdk";
import { eq } from "drizzle-orm";

import { buildHeartbeatPrompt } from "./prompt-builder";

export type HeartbeatRunResult =
  | { success: true; eventId: string }
  | { success: false; error: string; eventId?: string };

const MODEL_ID = "composer-2";

/**
 * Build prompt, invoke Cursor Agent SDK locally, log `heartbeat_run` to `orchestration_events`.
 */
export async function runHeartbeat(agentId: string): Promise<HeartbeatRunResult> {
  let businessId: string;
  try {
    ({ businessId } = await assertUserOwnsAgent(agentId));
  } catch {
    return { success: false, error: "Forbidden" };
  }

  const db = getDb();

  const agentRow = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    columns: { systemRoleId: true },
  });

  if (agentRow?.systemRoleId) {
    const role = await db.query.systemRoles.findFirst({
      where: eq(systemRoles.id, agentRow.systemRoleId),
      columns: { runsHeartbeat: true },
    });

    if (role?.runsHeartbeat === true) {
      const [eventRow] = await db
        .insert(orchestrationEvents)
        .values({
          businessId,
          type: "lead_heartbeat",
          payload: { agentId, trigger: "manual_ui" },
          status: "pending",
        })
        .returning({ id: orchestrationEvents.id });
      return { success: true, eventId: eventRow?.id ?? "unknown" };
    }
  }

  const businessRow = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: { localPath: true },
  });

  const localPath = businessRow?.localPath?.trim();
  if (!localPath) {
    return {
      success: false,
      error: "Set the business workspace path (local folder) before running heartbeat.",
    };
  }

  const apiKey = await getUserCursorApiKeyDecrypted();
  if (!apiKey?.trim()) {
    return {
      success: false,
      error: "Save your Cursor API key under Settings before running heartbeat.",
    };
  }

  const prompt = await buildHeartbeatPrompt(agentId);
  let tokensIn = 0;
  let tokensOut = 0;

  const started = Date.now();

  async function persistEvent(payload: Record<string, unknown>, status: "succeeded" | "failed") {
    const inserted = await db
      .insert(orchestrationEvents)
      .values({
        businessId,
        type: "heartbeat_run",
        payload,
        status,
      })
      .returning({ id: orchestrationEvents.id });
    return inserted[0]?.id;
  }

  let agentSdk: import("@cursor/sdk").SDKAgent | null = null;
  try {
    agentSdk = await Agent.create({
      apiKey: apiKey.trim(),
      model: { id: MODEL_ID },
      local: { cwd: localPath },
    });

    const run = await agentSdk.send(prompt);

    for await (const msg of run.stream()) {
      if (
        typeof msg === "object" &&
        msg !== null &&
        "usage" in msg &&
        typeof (msg as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage ===
          "object" &&
        (msg as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage !== null
      ) {
        const u = (msg as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage!;
        tokensIn =
          typeof u.prompt_tokens === "number" ? u.prompt_tokens + tokensIn : tokensIn + 0;
        tokensOut =
          typeof u.completion_tokens === "number" ? u.completion_tokens + tokensOut : tokensOut + 0;
      }
    }

    const result = await run.wait();
    const durationMs =
      typeof result.durationMs === "number" ? result.durationMs : Date.now() - started;

    const eventId = await persistEvent(
      {
        agentId,
        trigger: "manual",
        tokensIn,
        tokensOut,
        model: result.model?.id ?? MODEL_ID,
        durationMs,
      },
      "succeeded",
    );

    if (!eventId) {
      return { success: false, error: "Failed to record orchestration event" };
    }
    return { success: true, eventId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const durationMs = Date.now() - started;
    const eventId = await persistEvent(
      {
        agentId,
        trigger: "manual",
        tokensIn,
        tokensOut,
        model: MODEL_ID,
        durationMs,
        error: message,
      },
      "failed",
    );
    return { success: false, error: message, ...(eventId ? { eventId } : {}) };
  } finally {
    if (agentSdk) {
      try {
        agentSdk.close();
      } catch {
        /* ignore */
      }
    }
  }
}
