import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/github/client", () => ({
  getInstallationToken: vi.fn(async () => "tok"),
}));

vi.mock("@/lib/github/repo-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/github/repo-context")>(
    "@/lib/github/repo-context",
  );
  return {
    ...actual,
    resolveRepoUrl: vi.fn(async () => "https://github.com/acme/mercflow"),
  };
});

import { buildRepoSummaryForMission } from "@/lib/github/repo-summary";

describe("buildRepoSummaryForMission", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it("returns parsed summary for contents + commits", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/repos/acme/mercflow/commits")) {
        return {
          ok: true,
          json: async () => [
            {
              sha: "abcdef1234567890",
              commit: {
                message: "feat: hello\n\nbody",
                author: { date: "2026-05-01T12:00:00Z" },
              },
            },
          ],
        };
      }
      if (url.includes("/repos/acme/mercflow/contents")) {
        return {
          ok: true,
          json: async () => [
            { type: "dir", name: "lib", path: "lib" },
            { type: "file", name: "README.md", path: "README.md" },
          ],
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const summary = await buildRepoSummaryForMission("biz-1");
    expect(summary).not.toBeNull();
    expect(summary!.repoName).toBe("acme/mercflow");
    expect(summary!.repoUrl).toBe("https://github.com/acme/mercflow");
    expect(summary!.topLevel).toEqual([
      { name: "lib", type: "dir" },
      { name: "README.md", type: "file" },
    ]);
    expect(summary!.recentCommits[0]?.sha).toBe("abcdef1");
    expect(summary!.recentCommits[0]?.message).toBe("feat: hello");
    expect(summary!.recentCommits[0]?.date).toBe("2026-05-01T12:00:00Z");
  });

  it("returns null when both listings fail", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const summary = await buildRepoSummaryForMission("biz-1");
    expect(summary).toBeNull();
  });
});
