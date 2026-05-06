import { dispatchOrchestrationEvent } from "./dispatch";
import { runnerLogError } from "./logger";
import {
  finishOrchestrationEvent,
  getBusinessMaxParallelRuns,
  getLeadAgentIdForBusiness,
  getOrchestrationEventById,
  listPendingOrchestrationEvents,
  pickAgentIdOverrideFromOrchestrationPayload,
  resolveRunnerCursorApiKey,
  tryClaimOrchestrationEvent,
} from "./queries";

const inFlight = new Set<string>();
const agentInFlight = new Set<string>();
const businessInFlight = new Map<string, number>();

function bumpBusinessConcurrent(businessId: string): void {
  businessInFlight.set(businessId, (businessInFlight.get(businessId) ?? 0) + 1);
}

function unbumpBusinessConcurrent(businessId: string): void {
  const next = (businessInFlight.get(businessId) ?? 1) - 1;
  if (next <= 0) businessInFlight.delete(businessId);
  else businessInFlight.set(businessId, next);
}

export async function pollOnce(): Promise<void> {
  const pending = await listPendingOrchestrationEvents(8);
  /** Dedupe DB reads when several pending rows share the same business in one tick. */
  const leadAgentCache = new Map<string, string | null>();
  const maxParallelCache = new Map<string, number | null>();

  async function getCachedLeadAgent(businessId: string): Promise<string | null> {
    if (!leadAgentCache.has(businessId)) {
      leadAgentCache.set(businessId, await getLeadAgentIdForBusiness(businessId));
    }
    return leadAgentCache.get(businessId) ?? null;
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
      agentOverride ?? (full.businessId ? await getCachedLeadAgent(full.businessId) : null);

    const businessId = full.businessId;

    if (resolvedAgentId && agentInFlight.has(resolvedAgentId)) continue;

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

    void (async () => {
      try {
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
      } finally {
        reconcileInFlightSets();
      }
    })().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      runnerLogError("runner/poll", `Unhandled error for event ${row.id}:`, msg);
    });
  }
}
