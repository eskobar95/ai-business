import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.hoisted(() => vi.fn());

vi.mock("@/db/index", () => ({
  getDb() {
    return {
      query: {
        tasks: {
          findFirst,
        },
      },
    };
  },
}));

import { evaluateTaskGates } from "../gate-evaluator";

describe("evaluateTaskGates", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("returns ready=true when no gates are set", async () => {
    findFirst.mockResolvedValueOnce({
      dependencyTaskId: null,
      githubPrNumber: null,
      prMergedToIntegration: false,
    });

    const r = await evaluateTaskGates("t1");
    expect(r.ready).toBe(true);
    expect(r.dependencyOk).toBe(true);
    expect(r.prOk).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it("returns ready=true when dependency is done and no PR", async () => {
    findFirst
      .mockResolvedValueOnce({
        dependencyTaskId: "dep-1",
        githubPrNumber: null,
        prMergedToIntegration: false,
      })
      .mockResolvedValueOnce({ status: "done", title: "Dep" });

    const r = await evaluateTaskGates("t1");
    expect(r.ready).toBe(true);
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it("returns ready=false when dependency is not done", async () => {
    findFirst
      .mockResolvedValueOnce({
        dependencyTaskId: "dep-1",
        githubPrNumber: null,
        prMergedToIntegration: false,
      })
      .mockResolvedValueOnce({ status: "in_progress", title: "Dep" });

    const r = await evaluateTaskGates("t1");
    expect(r.ready).toBe(false);
    expect(r.dependencyOk).toBe(false);
    expect(r.reasons.some((x) => x.includes("not done"))).toBe(true);
  });

  it("returns ready=true when PR is merged and no dependency", async () => {
    findFirst.mockResolvedValueOnce({
      dependencyTaskId: null,
      githubPrNumber: 42,
      prMergedToIntegration: true,
    });

    const r = await evaluateTaskGates("t1");
    expect(r.ready).toBe(true);
    expect(r.prOk).toBe(true);
  });

  it("returns ready=false when PR is not merged", async () => {
    findFirst.mockResolvedValueOnce({
      dependencyTaskId: null,
      githubPrNumber: 7,
      prMergedToIntegration: false,
    });

    const r = await evaluateTaskGates("t1");
    expect(r.ready).toBe(false);
    expect(r.prOk).toBe(false);
    expect(r.reasons.some((x) => x.includes("PR #7"))).toBe(true);
  });

  it("returns ready=true when both dependency done AND PR merged", async () => {
    findFirst
      .mockResolvedValueOnce({
        dependencyTaskId: "dep-1",
        githubPrNumber: 99,
        prMergedToIntegration: true,
      })
      .mockResolvedValueOnce({ status: "done", title: "Dep" });

    const r = await evaluateTaskGates("t1");
    expect(r.ready).toBe(true);
  });

  it("returns ready=false when dependency ok but PR not merged", async () => {
    findFirst
      .mockResolvedValueOnce({
        dependencyTaskId: "dep-1",
        githubPrNumber: 3,
        prMergedToIntegration: false,
      })
      .mockResolvedValueOnce({ status: "done", title: "Dep" });

    const r = await evaluateTaskGates("t1");
    expect(r.ready).toBe(false);
    expect(r.dependencyOk).toBe(true);
    expect(r.prOk).toBe(false);
  });

  it("returns ready=false when PR ok but dependency not done", async () => {
    findFirst
      .mockResolvedValueOnce({
        dependencyTaskId: "dep-1",
        githubPrNumber: 3,
        prMergedToIntegration: true,
      })
      .mockResolvedValueOnce({ status: "todo", title: "Dep" });

    const r = await evaluateTaskGates("t1");
    expect(r.ready).toBe(false);
    expect(r.dependencyOk).toBe(false);
    expect(r.prOk).toBe(true);
  });

  it("includes multiple human-readable reasons when not ready", async () => {
    findFirst
      .mockResolvedValueOnce({
        dependencyTaskId: "dep-1",
        githubPrNumber: 5,
        prMergedToIntegration: false,
      })
      .mockResolvedValueOnce({ status: "blocked", title: "Dep" });

    const r = await evaluateTaskGates("t1");
    expect(r.ready).toBe(false);
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it("throws when task not found", async () => {
    findFirst.mockResolvedValueOnce(undefined);
    await expect(evaluateTaskGates("missing")).rejects.toThrow("not found");
  });
});
