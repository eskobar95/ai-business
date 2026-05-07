import { Agent } from "@cursor/sdk";
import type { SDKAssistantMessage } from "@cursor/sdk";

import { promoteTaskToTodoByRunner } from "@/lib/tasks/runner-promote";
import { evaluateTaskGates } from "@/lib/tasks/gate-evaluator";
import { getDb } from "@/db/index";
import { tasks } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

import { buildLeadHeartbeatPrompt } from "./lead-heartbeat-prompt";
import { assertBusinessReadyForExecution } from "./readiness-check";
import { resolveCursorConfig } from "./cursor-config-resolver";
import {
  finishOrchestrationEvent,
  getBusinessLocalPath,
  getLeadHeartbeatAgentForBusiness,
} from "./queries";
import { runnerLog, runnerLogError } from "./logger";
import {
  appendAssistantTextFromAssistantMessage,
  truncateAssistantTextForPayload,
} from "./sdk-assistant-text";

/**
 * Parses lead-agent output for a JSON list of task IDs to promote.
 * Expects the agent to output a JSON block like:
 * ```json
 * { "promote": ["uuid-1", "uuid-2"] }
 * ```
 * Falls back to empty array if output can't be parsed — never throws.
 */
export function parseLeadOutput(fullText: string): string[] {
  const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    const rawMatch = fullText.match(/\{\s*"promote"\s*:\s*\[([\s\S]*?)\]/);
    if (!rawMatch) return [];
    try {
      const parsed = JSON.parse(`{"promote":[${rawMatch[1]}]}`) as { promote?: unknown };
      return Array.isArray(parsed.promote)
        ? parsed.promote.filter((x): x is string => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  }
  try {
    const parsed = JSON.parse(jsonMatch[1].trim()) as { promote?: unknown };
    return Array.isArray(parsed.promote)
      ? parsed.promote.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

async function getPromotableCandidates(
  businessId: string,
  db: ReturnType<typeof getDb>,
): Promise<
  Array<{
    id: string;
    title: string;
    description: string | null;
    dependencyTaskId: string | null;
    dependencyBlocksPromotion: boolean;
    githubPrNumber: number | null;
    prMergedToIntegration: boolean;
    agentId: string | null;
  }>
> {
  const rows = await db.query.tasks.findMany({
    where: and(eq(tasks.businessId, businessId), eq(tasks.status, "backlog")),
    columns: {
      id: true,
      title: true,
      description: true,
      dependencyTaskId: true,
      githubPrNumber: true,
      prMergedToIntegration: true,
      agentId: true,
    },
  });

  const depIds = [...new Set(rows.map((r) => r.dependencyTaskId).filter(Boolean) as string[])];
  const depRows =
    depIds.length === 0
      ? []
      : await db.query.tasks.findMany({
          where: inArray(tasks.id, depIds),
          columns: { id: true, status: true },
        });
  const depStatus = new Map(depRows.map((d) => [d.id, d.status]));

  return rows.map((r) => {
    const depBlocks =
      r.dependencyTaskId != null && depStatus.get(r.dependencyTaskId) !== "done";
    return {
      ...r,
      dependencyBlocksPromotion: depBlocks,
    };
  });
}

export async function dispatchLeadHeartbeat(
  eventId: string,
  event: { businessId: string | null; payload: Record<string, unknown> },
  apiKey: string,
): Promise<void> {
  const businessId = event.businessId;
  if (!businessId) {
    await finishOrchestrationEvent(eventId, {
      status: "failed",
      payload: { ...event.payload, runnerError: "lead_heartbeat requires businessId" },
    });
    return;
  }

  const localPath = await getBusinessLocalPath(businessId);

  try {
    await assertBusinessReadyForExecution(businessId, localPath);
  } catch (e) {
    await finishOrchestrationEvent(eventId, {
      status: "failed",
      payload: { ...event.payload, runnerError: e instanceof Error ? e.message : String(e) },
    });
    return;
  }

  const db = getDb();

  const leadAgent = await getLeadHeartbeatAgentForBusiness(businessId);
  if (!leadAgent) {
    await finishOrchestrationEvent(eventId, {
      status: "failed",
      payload: {
        ...event.payload,
        runnerError: "No agent with runsHeartbeat=true found for business.",
      },
    });
    return;
  }

  const backlogTasks = await getPromotableCandidates(businessId, db);

  const prompt = await buildLeadHeartbeatPrompt({
    agentId: leadAgent.id,
    businessId,
    backlogTasks,
  });

  const cursorConfig = await resolveCursorConfig(leadAgent.id, businessId);

  const root = localPath!.trim();
  let agentSdk: import("@cursor/sdk").SDKAgent | null = null;
  let fullText = "";

  try {
    agentSdk = await Agent.create({
      apiKey: apiKey || process.env.CURSOR_API_KEY || "",
      ...(cursorConfig.modelId ? { model: { id: cursorConfig.modelId } } : {}),
      local: { cwd: root },
    });

    const run = await agentSdk.send(prompt);

    for await (const msg of run.stream()) {
      if (
        typeof msg !== "object" ||
        msg === null ||
        (msg as { type?: unknown }).type !== "assistant"
      ) {
        continue;
      }
      fullText = appendAssistantTextFromAssistantMessage(fullText, msg as SDKAssistantMessage);
    }

    await run.wait();

    const rawPromotions = parseLeadOutput(fullText);
    const promotions = [...new Set(rawPromotions)];
    const cap = leadAgent.heartbeatPromotionCap;
    const toPromote = promotions.slice(0, cap);

    runnerLog(
      "runner/lead-heartbeat",
      `Lead ${leadAgent.name} wants to promote ${promotions.length} tasks; cap=${cap} → attempting ${toPromote.length}`,
    );

    const candidateIds = new Set(backlogTasks.map((t) => t.id));
    const promoted: string[] = [];
    const errors: string[] = [];

    for (const taskId of toPromote) {
      if (!candidateIds.has(taskId)) {
        errors.push(`${taskId}: not in backlog candidate set for this business`);
        runnerLogError("runner/lead-heartbeat", `Skipping unknown task id from model: ${taskId}`);
        continue;
      }

      try {
        const gates = await evaluateTaskGates(taskId);
        if (!gates.ready) {
          const reason = gates.reasons.join("; ") || "gates not satisfied";
          errors.push(`${taskId}: ${reason}`);
          runnerLogError("runner/lead-heartbeat", `Skipping blocked task ${taskId}: ${reason}`);
          continue;
        }

        await promoteTaskToTodoByRunner(taskId, leadAgent.id);
        promoted.push(taskId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${taskId}: ${msg}`);
        runnerLogError("runner/lead-heartbeat", `Failed to promote task ${taskId}:`, msg);
      }
    }

    await finishOrchestrationEvent(eventId, {
      status: "succeeded",
      payload: {
        ...event.payload,
        leadAgentId: leadAgent.id,
        candidatesFound: backlogTasks.length,
        promotionsRequested: promotions.length,
        promotionsCapped: toPromote.length,
        promoted,
        errors,
        runner: {
          assistantOutput: truncateAssistantTextForPayload(fullText),
        },
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    runnerLogError("runner/lead-heartbeat", "Lead heartbeat failed:", message);
    await finishOrchestrationEvent(eventId, {
      status: "failed",
      payload: {
        ...event.payload,
        runnerError: message,
        ...(fullText.length > 0
          ? { runner: { assistantOutput: truncateAssistantTextForPayload(fullText) } }
          : {}),
      },
    });
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
