import { beforeEach, describe, expect, it, vi } from "vitest";

const evaluateTaskGates = vi.hoisted(() =>
  vi.fn(async () => ({ ready: true, dependencyOk: true, prOk: true, reasons: [] as string[] })),
);

vi.mock("../gate-evaluator", () => ({
  evaluateTaskGates,
}));

const logEvent = vi.hoisted(() => vi.fn(async () => "evt-1"));

vi.mock("@/lib/orchestration/events", () => ({
  logEvent,
}));

const findFirst = vi.hoisted(() => vi.fn());
const updateFn = vi.hoisted(() => vi.fn());

vi.mock("@/db/index", () => ({
  getDb() {
    return {
      query: {
        tasks: {
          findFirst,
        },
      },
      update: updateFn,
    };
  },
}));

import { maybeAutoTriggerTask } from "../auto-trigger";

describe("maybeAutoTriggerTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateTaskGates.mockResolvedValue({
      ready: true,
      dependencyOk: true,
      prOk: true,
      reasons: [],
    });
    findFirst.mockResolvedValue({
      status: "todo",
      businessId: "biz-1",
      agentId: "ag-1",
      gatesLockedAt: null,
    });
    updateFn.mockImplementation(() => ({
      set: () => ({
        where: () => ({
          returning: vi.fn(async () => [{ id: "task-1" }]),
        }),
      }),
    }));
  });

  it("does nothing for non-todo tasks", async () => {
    findFirst.mockResolvedValueOnce({
      status: "backlog",
      businessId: "biz-1",
      agentId: null,
      gatesLockedAt: null,
    });

    const r = await maybeAutoTriggerTask("task-1");
    expect(r.triggered).toBe(false);
    expect(evaluateTaskGates).not.toHaveBeenCalled();
  });

  it("does nothing when gatesLockedAt is already set (idempotency)", async () => {
    findFirst.mockResolvedValueOnce({
      status: "todo",
      businessId: "biz-1",
      agentId: "ag-1",
      gatesLockedAt: new Date(),
    });

    const r = await maybeAutoTriggerTask("task-1");
    expect(r.triggered).toBe(false);
    expect(evaluateTaskGates).not.toHaveBeenCalled();
  });

  it("does nothing when gates are not ready", async () => {
    evaluateTaskGates.mockResolvedValueOnce({
      ready: false,
      dependencyOk: false,
      prOk: true,
      reasons: ["blocked"],
    });

    const r = await maybeAutoTriggerTask("task-1");
    expect(r.triggered).toBe(false);
    expect(r.reasons).toEqual(["blocked"]);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("creates webhook_trigger and sets gatesLockedAt when gates are ready", async () => {
    const returning = vi.fn(async () => [{ id: "task-1" }]);
    updateFn.mockImplementationOnce(() => ({
      set: (patch: Record<string, unknown>) => {
        expect(patch.gatesLockedAt).toBeInstanceOf(Date);
        return {
          where: () => ({
            returning,
          }),
        };
      },
    }));

    const r = await maybeAutoTriggerTask("task-1");
    expect(r.triggered).toBe(true);
    expect(returning).toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "webhook_trigger",
        businessId: "biz-1",
        status: "pending",
        payload: {
          taskId: "task-1",
          agentId: "ag-1",
          trigger: "auto_todo",
        },
      }),
    );
  });

  it("handles optimistic lock collision gracefully", async () => {
    const returning = vi.fn(async () => [] as { id: string }[]);
    updateFn.mockImplementationOnce(() => ({
      set: () => ({
        where: () => ({
          returning,
        }),
      }),
    }));

    const r = await maybeAutoTriggerTask("task-1");
    expect(r.triggered).toBe(false);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("includes agentId in payload when task has assignedAgent", async () => {
    findFirst.mockResolvedValueOnce({
      status: "todo",
      businessId: "biz-1",
      agentId: "assigned-99",
      gatesLockedAt: null,
    });
    updateFn.mockImplementationOnce(() => ({
      set: () => ({
        where: () => ({
          returning: vi.fn(async () => [{ id: "task-1" }]),
        }),
      }),
    }));

    await maybeAutoTriggerTask("task-1");
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ agentId: "assigned-99" }),
      }),
    );
  });

  it("omits agentId in payload when task has no assignee", async () => {
    findFirst.mockResolvedValueOnce({
      status: "todo",
      businessId: "biz-1",
      agentId: null,
      gatesLockedAt: null,
    });
    updateFn.mockImplementationOnce(() => ({
      set: () => ({
        where: () => ({
          returning: vi.fn(async () => [{ id: "task-1" }]),
        }),
      }),
    }));

    await maybeAutoTriggerTask("task-1");
    expect(logEvent).toHaveBeenCalled();
    const firstRow = Array.from(logEvent.mock.calls as unknown[]).at(0) as unknown[] | undefined;
    const arg = Array.isArray(firstRow) ? (firstRow[0] as unknown as { payload: Record<string, unknown> }) : undefined;
    expect(arg?.payload.taskId).toBe("task-1");
    expect(arg?.payload.agentId).toBeUndefined();
  });
});
