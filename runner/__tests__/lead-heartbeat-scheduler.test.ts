import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../dispatch", () => ({
  dispatchOrchestrationEvent: vi.fn(),
}));

vi.mock("@/lib/settings/cursor-api-key", () => ({
  resolveCursorApiKeyForBusiness: vi.fn(),
}));

import * as orchestrationEvents from "@/lib/orchestration/events";
import * as queries from "../queries";
import { resetLeadHeartbeatSchedulerStateForTests, scheduleLeadHeartbeats } from "../poll";

describe("scheduleLeadHeartbeats", () => {
  beforeEach(() => {
    resetLeadHeartbeatSchedulerStateForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLeadHeartbeatSchedulerStateForTests();
  });

  it("creates lead_heartbeat event when interval has elapsed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const logSpy = vi.spyOn(orchestrationEvents, "logEvent").mockResolvedValue("evt-1");
    vi.spyOn(queries, "getBusinessesWithLeadAgent").mockResolvedValue([{ businessId: "biz-1" }]);

    await scheduleLeadHeartbeats();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]?.[0]).toMatchObject({
      type: "lead_heartbeat",
      businessId: "biz-1",
      status: "pending",
    });

    await scheduleLeadHeartbeats();
    expect(logSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await scheduleLeadHeartbeats();
    expect(logSpy).toHaveBeenCalledTimes(2);
  });

  it("does not create event if interval has not elapsed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
    const logSpy = vi.spyOn(orchestrationEvents, "logEvent").mockResolvedValue("evt-1");
    vi.spyOn(queries, "getBusinessesWithLeadAgent").mockResolvedValue([{ businessId: "biz-x" }]);

    await scheduleLeadHeartbeats();
    expect(logSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    await scheduleLeadHeartbeats();
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("handles multiple businesses independently", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const logSpy = vi.spyOn(orchestrationEvents, "logEvent").mockResolvedValue("evt-1");
    vi.spyOn(queries, "getBusinessesWithLeadAgent").mockResolvedValue([
      { businessId: "biz-a" },
      { businessId: "biz-b" },
    ]);

    await scheduleLeadHeartbeats();
    expect(logSpy).toHaveBeenCalledTimes(2);
    const ids = logSpy.mock.calls.map((c) => (c[0] as { businessId?: string }).businessId);
    expect(ids).toContain("biz-a");
    expect(ids).toContain("biz-b");
  });
});
