import { Agent } from "@cursor/sdk";
import type { SDKAssistantMessage } from "@cursor/sdk";
import { resolve as pathResolve } from "node:path";

import { getAgentStatus, logAgentLifecycleStatus } from "@/lib/orchestration/events";
import { taskLogs } from "@/db/schema";
import { getDb } from "@/db/index";
import { resolveCursorConfig } from "./cursor-config-resolver";
import { dispatchLeadHeartbeat } from "./lead-heartbeat";
import { buildOrchestrationPrompt } from "./prompt-builder";
import { runGitPreflight } from "./git-preflight";
import { assertBusinessReadyForExecution } from "./readiness-check";
import {
  finishOrchestrationEvent,
  getBusinessIntegrationBranch,
  getBusinessLocalPath,
  getLatestBusinessMemoryContent,
  getLeadAgentIdForBusiness,
  getTaskPrBranch,
  loadAgentForRun,
  loadAgentSkillsContext,
  pickAgentIdOverrideFromOrchestrationPayload,
} from "./queries";
import {
  appendAssistantTextFromAssistantMessage,
  RUNNER_ASSISTANT_OUTPUT_MAX_CHARS,
} from "./sdk-assistant-text";

const PLATFORM_FALLBACK_MODEL = "composer-2";

const SUPPORTED_EVENT_TYPES = new Set(["webhook_trigger", "mention_trigger", "lead_heartbeat"]);

function pickTaskId(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.taskId === "string" && payload.taskId.trim()) return payload.taskId.trim();
  const body = payload.body;
  if (body && typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;
    if (typeof b.taskId === "string" && b.taskId.trim()) return b.taskId.trim();
    if (typeof b.task_id === "string" && b.task_id.trim()) return b.task_id.trim();
  }
  return undefined;
}

function pickMentionExcerpt(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.excerpt === "string") {
    const e = payload.excerpt.trim();
    return e.length > 0 ? e : undefined;
  }
  if (typeof payload.mentionExcerpt === "string") {
    const e = payload.mentionExcerpt.trim();
    return e.length > 0 ? e : undefined;
  }
  return undefined;
}

export async function dispatchOrchestrationEvent(
  eventId: string,
  event: {
    businessId: string | null;
    type: string;
    payload: Record<string, unknown>;
  },
  apiKey: string,
): Promise<void> {
  const businessId = event.businessId;
  if (!businessId) {
    await finishOrchestrationEvent(eventId, {
      status: "failed",
      payload: { ...event.payload, runnerError: "Missing businessId on event" },
    });
    return;
  }

  if (!SUPPORTED_EVENT_TYPES.has(event.type)) {
    await finishOrchestrationEvent(eventId, {
      status: "failed",
      payload: {
        ...event.payload,
        runnerError: `Unsupported orchestration type: ${event.type}`,
      },
    });
    return;
  }

  if (event.type === "lead_heartbeat") {
    await dispatchLeadHeartbeat(eventId, event, apiKey);
    return;
  }

  const localPath = await getBusinessLocalPath(businessId);
  try {
    await assertBusinessReadyForExecution(businessId, localPath);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await finishOrchestrationEvent(eventId, {
      status: "failed",
      payload: { ...event.payload, runnerError: message },
    });
    return;
  }

  const agentIdOverride = pickAgentIdOverrideFromOrchestrationPayload(event.payload);
  const agentId = agentIdOverride ?? (await getLeadAgentIdForBusiness(businessId));
  if (!agentId) {
    await finishOrchestrationEvent(eventId, {
      status: "failed",
      payload: {
        ...event.payload,
        runnerError: "No target agent: set agentId in webhook body or create a team with a lead agent.",
      },
    });
    return;
  }

  const agent = await loadAgentForRun(agentId);
  if (!agent || agent.businessId !== businessId) {
    await finishOrchestrationEvent(eventId, {
      status: "failed",
      payload: { ...event.payload, runnerError: "Agent not found or wrong business." },
    });
    return;
  }

  if (!agent.systemRoleId || !agent.systemRole) {
    await finishOrchestrationEvent(eventId, {
      status: "failed",
      payload: {
        ...event.payload,
        runnerError: "Agent has no system role assigned. Pick one in agent settings.",
      },
    });
    return;
  }

  const life = await getAgentStatus(agentId);
  if (life !== "idle") {
    await finishOrchestrationEvent(eventId, {
      status: "failed",
      payload: {
        ...event.payload,
        runnerError: `Agent is not idle (status: ${life}). Wait for current work to finish.`,
      },
    });
    return;
  }

  const instructions = agent.documents[0]?.content ?? "";
  const memoryMd = await getLatestBusinessMemoryContent(businessId);
  const skillsBlock = await loadAgentSkillsContext(agentId);
  const mentionExcerpt =
    event.type === "mention_trigger" ? pickMentionExcerpt(event.payload) : undefined;

  const prompt = buildOrchestrationPrompt({
    mentionExcerpt,
    systemRoleBasePrompt: agent.systemRole.baseSystemPrompt,
    includeBusinessMemory: agent.systemRole.includeBusinessContext,
    businessMemoryMarkdown: memoryMd,
    agentInstructions: instructions,
    skillsBlock,
    orchestrationPayload: event.payload,
  });

  const taskId = pickTaskId(event.payload);
  const rootAbs = pathResolve(localPath!.trim());

  let cwd: string;
  let cleanup: () => void;

  if (agent.systemRole.requiresGitWorkspace) {
    const integrationBranch = await getBusinessIntegrationBranch(businessId);
    if (!integrationBranch) {
      await finishOrchestrationEvent(eventId, {
        status: "failed",
        payload: {
          ...event.payload,
          runnerError: "integrationBranch not set in workspace settings.",
        },
      });
      return;
    }
    const prBranch = taskId ? await getTaskPrBranch(taskId) : undefined;
    try {
      ({ cwd, cleanup } = await runGitPreflight({
        localPath: rootAbs,
        integrationBranch,
        prBranch,
        worktreeKey: taskId ?? eventId,
        businessId,
        eventId,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await finishOrchestrationEvent(eventId, {
        status: "failed",
        payload: { ...event.payload, runnerError: message },
      });
      return;
    }
  } else {
    cwd = rootAbs;
    cleanup = () => undefined;
  }

  const cursorConfig = await resolveCursorConfig(agentId, businessId);

  let agentSdk: Awaited<ReturnType<typeof Agent.create>> | null = null;
  const started = Date.now();
  try {
    await logAgentLifecycleStatus(businessId, agentId, "working", { source: "runner", eventId });
    // `cursorConfig.thinkingEffort` is stored on the finished event for observability.
    // `@cursor/sdk` Agent.create typing in this version only exposes `model` + `local` here; if the SDK
    // adds a first-class effort/extended-thinking field, wire it alongside `model`.
    agentSdk = await Agent.create({
      apiKey: apiKey.trim(),
      ...(cursorConfig.modelId ? { model: { id: cursorConfig.modelId } } : {}),
      local: { cwd },
    });
    const run = await agentSdk.send(prompt);

    let text = "";
    let tokensIn = 0;
    let tokensOut = 0;
    for await (const msg of run.stream()) {
      if (
        typeof msg === "object" &&
        msg !== null &&
        "usage" in msg &&
        typeof (msg as { usage?: unknown }).usage === "object" &&
        (msg as { usage?: unknown }).usage !== null
      ) {
        const u = (msg as unknown as {
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        }).usage;
        if (u) {
          if (typeof u.prompt_tokens === "number") tokensIn += u.prompt_tokens;
          if (typeof u.completion_tokens === "number") tokensOut += u.completion_tokens;
        }
      }
      if (typeof msg !== "object" || msg === null || (msg as { type?: unknown }).type !== "assistant")
        continue;
      const assistant = msg as SDKAssistantMessage;
      text = appendAssistantTextFromAssistantMessage(text, assistant);
    }

    const result = await run.wait();
    const durationMs =
      typeof result.durationMs === "number" ? result.durationMs : Date.now() - started;

    const out =
      text.length > RUNNER_ASSISTANT_OUTPUT_MAX_CHARS
        ? `${text.slice(0, RUNNER_ASSISTANT_OUTPUT_MAX_CHARS)}\n\n…(truncated)`
        : text;

    const resolvedModelLabel =
      result.model?.id ?? cursorConfig.modelId ?? PLATFORM_FALLBACK_MODEL;

    const nextPayload: Record<string, unknown> = {
      ...event.payload,
      runner: {
        agentId,
        agentName: agent.name,
        systemRoleSlug: agent.systemRole.slug,
        model: resolvedModelLabel,
        cursorThinkingEffort: cursorConfig.thinkingEffort ?? null,
        durationMs,
        tokensIn,
        tokensOut,
        assistantOutput: out,
        cwd,
      },
    };

    await finishOrchestrationEvent(eventId, { status: "succeeded", payload: nextPayload });

    if (taskId) {
      const db = getDb();
      await db.insert(taskLogs).values({
        taskId,
        authorType: "agent",
        authorId: agentId,
        content: `Runner completed (event ${eventId}).\n\n${out.slice(0, 12_000)}`,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await finishOrchestrationEvent(eventId, {
      status: "failed",
      payload: {
        ...event.payload,
        runnerError: message,
      },
    });
  } finally {
    cleanup();
    if (agentSdk) {
      try {
        agentSdk.close();
      } catch {
        /* ignore */
      }
    }
    await logAgentLifecycleStatus(businessId, agentId, "idle", { source: "runner", eventId });
  }
}
