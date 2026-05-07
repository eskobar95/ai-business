import { beforeEach, describe, expect, it, vi } from "vitest";

const dispatchOrchestrationEvent = vi.hoisted(() =>
  vi.fn(async () => {
    await Promise.resolve();
  }),
);

const listPendingOrchestrationEvents = vi.hoisted(() => vi.fn());
const getOrchestrationEventById = vi.hoisted(() => vi.fn());
const tryClaimOrchestrationEvent = vi.hoisted(() => vi.fn());
const resolveRunnerCursorApiKey = vi.hoisted(() => vi.fn());
const finishOrchestrationEvent = vi.hoisted(() => vi.fn());
const getBusinessMaxParallelRuns = vi.hoisted(() => vi.fn());
const getLeadAgentIdForBusiness = vi.hoisted(() => vi.fn());
const pickAgentIdOverrideFromOrchestrationPayload = vi.hoisted(() => vi.fn());

vi.mock("./dispatch", () => ({
  dispatchOrchestrationEvent,
}));

const getBusinessesWithLeadAgent = vi.hoisted(() => vi.fn());

vi.mock("./queries", () => ({
  listPendingOrchestrationEvents,
  getOrchestrationEventById,
  tryClaimOrchestrationEvent,
  resolveRunnerCursorApiKey,
  finishOrchestrationEvent,
  getBusinessMaxParallelRuns,
  getLeadAgentIdForBusiness,
  getBusinessesWithLeadAgent,
  pickAgentIdOverrideFromOrchestrationPayload,
}));

import { pollOnce } from "./poll";

describe("runner poll concurrency", () => {
  beforeEach(() => {
    dispatchOrchestrationEvent.mockClear();
    listPendingOrchestrationEvents.mockReset();
    getOrchestrationEventById.mockReset();
    tryClaimOrchestrationEvent.mockReset();
    resolveRunnerCursorApiKey.mockReset();
    finishOrchestrationEvent.mockReset();
    getBusinessMaxParallelRuns.mockReset();
    getLeadAgentIdForBusiness.mockReset();
    getBusinessesWithLeadAgent.mockReset();
    pickAgentIdOverrideFromOrchestrationPayload.mockReset();

    getBusinessesWithLeadAgent.mockResolvedValue([]);
    resolveRunnerCursorApiKey.mockResolvedValue("cursor-key");
    tryClaimOrchestrationEvent.mockResolvedValue({ ok: true });
    getBusinessMaxParallelRuns.mockResolvedValue(null);
    pickAgentIdOverrideFromOrchestrationPayload.mockImplementation((payload: Record<string, unknown>) =>
      typeof payload.agentId === "string" ? payload.agentId.trim() || undefined : undefined,
    );
    dispatchOrchestrationEvent.mockImplementation(async () => {
      await Promise.resolve();
    });
  });

  async function flushAsyncWork(): Promise<void> {
    for (let i = 0; i < 40; i += 1) {
      await Promise.resolve();
    }
  }

  it("blocks overlapping dispatches targeting the same agent", async () => {
    listPendingOrchestrationEvents.mockResolvedValue([{ id: "evt-1" }, { id: "evt-2" }]);

    let callIdx = 0;
    const sharedAgentId = "agent-shared";
    getOrchestrationEventById.mockImplementation(async () => {
      callIdx += 1;
      return {
        id: callIdx === 1 ? "evt-1" : "evt-2",
        businessId: "biz-1",
        type: "webhook_trigger",
        payload: {
          agentId: sharedAgentId,
        },
      };
    });

    await pollOnce();
    await flushAsyncWork();

    expect(dispatchOrchestrationEvent).toHaveBeenCalledTimes(1);
  });

  it("runs dispatches concurrently for distinct agents", async () => {
    listPendingOrchestrationEvents.mockResolvedValue([{ id: "evt-1" }, { id: "evt-2" }]);

    getOrchestrationEventById.mockImplementation(async (evtId: unknown) => ({
      id: typeof evtId === "string" ? evtId : "evt-unknown",
      businessId: "biz-1",
      type: "webhook_trigger",
      payload:
        evtId === "evt-1"
          ? { agentId: "agent-alpha" }
          : { agentId: "agent-beta" },
    }));

    await pollOnce();
    await flushAsyncWork();

    expect(dispatchOrchestrationEvent).toHaveBeenCalledTimes(2);
  });

  it("honours optional business parallelism caps", async () => {
    getBusinessMaxParallelRuns.mockResolvedValue(2);
    dispatchOrchestrationEvent.mockImplementation(() => new Promise(() => undefined));

    listPendingOrchestrationEvents.mockResolvedValue([
      { id: "evt-1" },
      { id: "evt-2" },
      { id: "evt-3" },
    ]);

    getOrchestrationEventById.mockImplementation(async (evtId: unknown) => {
      const safeId = typeof evtId === "string" ? evtId : "evt-unknown";
      return {
        id: safeId,
        businessId: "biz-1",
        type: "webhook_trigger",
        payload: {
          agentId:
            safeId === "evt-1" ? "agent-1" : safeId === "evt-2" ? "agent-2" : "agent-3",
        },
      };
    });

    await pollOnce();

    expect(dispatchOrchestrationEvent).toHaveBeenCalledTimes(2);
  });
});
