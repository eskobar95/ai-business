/* eslint-disable @typescript-eslint/no-explicit-any -- execFileSync has complex overload signatures in tests */
import { beforeEach, describe, expect, it, vi } from "vitest";

const execSpy = vi.hoisted(
  (): ReturnType<typeof vi.fn> => vi.fn(() => "") as any,
);

vi.mock("node:child_process", () => ({
  execFileSync: execSpy as unknown as typeof import("node:child_process").execFileSync,
}));

const logEvent = vi.hoisted(() => vi.fn(async () => "logged"));

vi.mock("@/lib/orchestration/events", () => ({
  logEvent,
}));

function mapLogSteps(spy: typeof logEvent): Array<string | undefined> {
  return (spy as unknown as { mock: { calls: unknown[] } }).mock.calls.map((entry) => {
    const evt = Array.isArray(entry)
      ? (Array.from(entry as unknown[])[0] as unknown as { payload?: { step?: string } } | undefined)
      : undefined;
    return evt?.payload?.step;
  });
}

import { runGitPreflight } from "./git-preflight";

describe("runner git preflight", () => {
  beforeEach(() => {
    execSpy.mockReset();
    execSpy.mockImplementation(() => "");
    logEvent.mockReset();
    logEvent.mockResolvedValue("evt-log");
  });

  it("logs fetch + checkout and returns integration root when no PR branch", async () => {
    const res = await runGitPreflight({
      localPath: "C:/repo",
      integrationBranch: "main",
      businessId: "biz-1",
      eventId: "evt-1",
    });

    expect(res.cwd.replace(/\\/g, "/")).toMatch(/\/repo$/u);

    const steps = mapLogSteps(logEvent);
    expect(steps.filter((s) => s === "fetch").length).toBe(1);
    expect(steps.filter((s) => s === "checkout_integration").length).toBe(1);
  });

  it("throws when repo is dirty before checkout", async () => {
    execSpy.mockImplementation(((...args: any[]) => {
      const file = args[0];
      const argv = Array.isArray(args[1]) ? (args[1] as readonly string[]) : undefined;
      if (file === "git" && argv?.includes("status") && argv.includes("--porcelain")) {
        return "M file.txt\n";
      }
      return "";
    }) as any);

    await expect(
      runGitPreflight({
        localPath: "/repo",
        integrationBranch: "main",
        businessId: "biz-1",
        eventId: "evt-2",
      }),
    ).rejects.toThrow(/changed path\(s\).*paths omitted/u);
  });

  it("bubbles fetch failures", async () => {
    execSpy.mockImplementation(((...args: any[]) => {
      const file = args[0];
      const argv = Array.isArray(args[1]) ? (args[1] as readonly string[]) : undefined;
      if (file === "git" && argv?.includes("fetch")) {
        throw new Error("network down");
      }
      return "";
    }) as any);

    await expect(
      runGitPreflight({
        localPath: "/repo",
        integrationBranch: "main",
        businessId: "biz-1",
        eventId: "evt-3",
      }),
    ).rejects.toThrow(/network down/u);
  });

  it("logs PR worktree creation when PR branch + key are provided", async () => {
    const res = await runGitPreflight({
      localPath: "/repo",
      integrationBranch: "main",
      prBranch: "feature/test",
      worktreeKey: "task-123",
      businessId: "biz-1",
      eventId: "evt-4",
    });

    expect(res.cwd.includes(".worktrees")).toBe(true);

    const steps = mapLogSteps(logEvent);
    expect(steps.includes("pr_worktree")).toBe(true);
  });
});
