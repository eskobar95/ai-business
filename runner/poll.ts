import { logEvent } from "@/lib/orchestration/events";

import { dispatchOrchestrationEvent } from "./dispatch";
import { runnerLog, runnerLogError } from "./logger";
import {
  finishOrchestrationEvent,
  getBusinessMaxParallelRuns,
  getBusinessesWithLeadAgent,
  getLeadAgentIdForBusiness,
  getLeadHeartbeatAgentIdForBusiness,
  getOrchestrationEventById,
  listPendingOrchestrationEvents,
  pickAgentIdOverrideFromOrchestrationPayload,
  resolveRunnerCursorApiKey,
  tryClaimOrchestrationEvent,
} from "./queries";

const inFlight = new Set<string>();
const agentInFlight = new Set<string>();
const businessInFlight = new Map<string, number>();

/** Clears in-process concurrency bookkeeping (Vitest only). */
export function resetPollConcurrencyStateForTests(): void {
  inFlight.clear();
  agentInFlight.clear();
  businessInFlight.clear();
}

function bumpBusinessConcurrent(businessId: string): void {
  businessInFlight.set(businessId, (businessInFlight.get(businessId) ?? 0) + 1);
}

function unbumpBusinessConcurrent(businessId: string): void {
  const next = (businessInFlight.get(businessId) ?? 1) - 1;
  if (next <= 0) businessInFlight.delete(businessId);
  else businessInFlight.set(businessId, next);
}

/** Fire-and-forget async work with guaranteed cleanup; surfaces unexpected rejections to the runner log. */
function runClaimedEvent(eventRowId: string, reconcile: () => void, work: () => Promise<void>): void {
  void (async () => {
    try {
      await work();
    } finally {
      reconcile();
    }
  })().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    runnerLogError("runner/poll", `Unhandled error for event ${eventRowId}:`, msg);
  });
}

export async function pollOnce(): Promise<void> {
  const pending = await listPendingOrchestrationEvents(8);
  /** Dedupe DB reads when several pending rows share the same business in one tick. */
  const leadAgentCache = new Map<string, string | null>();
  const leadHeartbeatAgentCache = new Map<string, string | null>();
  const maxParallelCache = new Map<string, number | null>();

  async function getCachedLeadAgent(businessId: string): Promise<string | null> {
    if (!leadAgentCache.has(businessId)) {
      leadAgentCache.set(businessId, await getLeadAgentIdForBusiness(businessId));
    }
    return leadAgentCache.get(businessId) ?? null;
  }

  async function getCachedLeadHeartbeatAgentId(businessId: string): Promise<string | null> {
    if (!leadHeartbeatAgentCache.has(businessId)) {
      leadHeartbeatAgentCache.set(
        businessId,
        await getLeadHeartbeatAgentIdForBusiness(businessId),
      );
    }
    return leadHeartbeatAgentCache.get(businessId) ?? null;
  }

  async function getCachedMaxParallel(businessId: string): Promise<number | null> {
    if (!maxParallelCache.has(businessId)) {
      maxParallelCache.set(businessId, await getBusinessMaxParallelRuns(businessId));
    }
    return maxParallelCache.get(businessId) ?? null;
  }

  for (const row of pending) {
    if (inFlight.has(row.id)) continue;

    const full = await getOrchestrationEventById(row.id);
    if (!full) continue;

    const raw = full.payload;
    const payload =
      raw && typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

    const agentOverride = pickAgentIdOverrideFromOrchestrationPayload(payload);
    const resolvedAgentId =
      agentOverride ??
      (full.businessId
        ? full.type === "lead_heartbeat"
          ? await getCachedLeadHeartbeatAgentId(full.businessId)
          : await getCachedLeadAgent(full.businessId)
        : null);

    const businessId = full.businessId;

    if (resolvedAgentId && agentInFlight.has(resolvedAgentId)) continue;

    // In-process throttle only: enforced before claim, so another tick could pass the check in a race.
    // Good enough for MVP; cross-process or strict limits need DB-level coordination.
    const maxParallel = businessId != null ? await getCachedMaxParallel(businessId) : null;
    if (maxParallel !== null && maxParallel > 0 && businessId) {
      const current = businessInFlight.get(businessId) ?? 0;
      if (current >= maxParallel) continue;
    }

    const claimed = await tryClaimOrchestrationEvent(row.id);
    if (!claimed) continue;

    inFlight.add(row.id);
    if (resolvedAgentId) agentInFlight.add(resolvedAgentId);
    if (businessId) bumpBusinessConcurrent(businessId);

    const reconcileInFlightSets = (): void => {
      inFlight.delete(row.id);
      if (resolvedAgentId) agentInFlight.delete(resolvedAgentId);
      if (businessId) unbumpBusinessConcurrent(businessId);
    };

    runClaimedEvent(row.id, reconcileInFlightSets, async () => {
      const skipApiKey = full.type === "lead_heartbeat";
      const apiKey = skipApiKey ? null : await resolveRunnerCursorApiKey(full.businessId);
      if (!skipApiKey && !apiKey) {
        await finishOrchestrationEvent(full.id, {
          status: "failed",
          payload: {
            ...payload,
            runnerError:
              "No Cursor API key: save a validated key under Settings/onboarding for a business member linked to this business, or set CURSOR_API_KEY for this runner process.",
          },
        });
        return;
      }

      await dispatchOrchestrationEvent(
        full.id,
        {
          businessId: full.businessId,
          type: full.type,
          payload,
        },
        apiKey?.trim() ?? "",
      );
    });
  }
}

/** Minimum interval between heartbeats per business (milliseconds). */
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

/** Tracks last scheduled heartbeat per businessId. In-process only; resets on restart. */
const lastHeartbeatScheduled = new Map<string, number>();

/** Clears in-process scheduler throttle (Vitest only). */
export function resetLeadHeartbeatSchedulerStateForTests(): void {
  lastHeartbeatScheduled.clear();
}

/**
 * For each business that has a lead agent (runsHeartbeat=true),
 * ensures a pending lead_heartbeat event exists if the interval has elapsed.
 * Safe to call on every poll tick — idempotent via time check.
 */
export async function scheduleLeadHeartbeats(): Promise<void> {
  const businessesWithLead = await getBusinessesWithLeadAgent();

  for (const { businessId } of businessesWithLead) {
    const last = lastHeartbeatScheduled.get(businessId);
    const now = Date.now();
    if (last !== undefined && now - last < HEARTBEAT_INTERVAL_MS) continue;

    try {
      await logEvent({
        type: "lead_heartbeat",
        businessId,
        payload: { trigger: "scheduled", scheduledAt: new Date(now).toISOString() },
        status: "pending",
      });
      lastHeartbeatScheduled.set(businessId, now);
      runnerLog("runner/poll", `Scheduled lead_heartbeat for business ${businessId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      runnerLogError("runner/poll", `Failed to schedule lead_heartbeat for ${businessId}:`, msg);
    }
  }
}
