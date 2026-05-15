import { beforeEach, describe, expect, it, vi } from "vitest";

const { agentsFindFirst, teamsFindFirst, deleteWhereMock } = vi.hoisted(() => ({
  agentsFindFirst: vi.fn(),
  teamsFindFirst: vi.fn(),
  deleteWhereMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/grill-me/access", () => ({
  assertUserBusinessAccess: vi.fn(async () => {}),
}));

vi.mock("@/lib/roster/session", () => ({
  requireSessionUserId: vi.fn(async () => "user-1"),
}));

vi.mock("@/db/index", () => ({
  getDb() {
    return {
      query: {
        agents: { findFirst: agentsFindFirst },
        teams: { findFirst: teamsFindFirst },
      },
      delete: vi.fn(() => ({
        where: deleteWhereMock,
      })),
    };
  },
}));

import { deleteAgent } from "@/lib/agents/actions.js";

describe("deleteAgent", () => {
  beforeEach(() => {
    agentsFindFirst.mockReset();
    teamsFindFirst.mockReset();
    deleteWhereMock.mockReset();
    deleteWhereMock.mockResolvedValue(undefined);
  });

  it("rejects platform default agents", async () => {
    agentsFindFirst.mockResolvedValueOnce({ businessId: "biz-1", isPlatformDefault: true });
    await expect(deleteAgent("cond-1")).rejects.toThrow("platform agent");
    expect(teamsFindFirst).not.toHaveBeenCalled();
    expect(deleteWhereMock).not.toHaveBeenCalled();
  });

  it("deletes when not platform default and not a team lead", async () => {
    agentsFindFirst.mockResolvedValueOnce({ businessId: "biz-1", isPlatformDefault: false });
    teamsFindFirst.mockResolvedValueOnce(null);
    await deleteAgent("agent-1");
    expect(deleteWhereMock).toHaveBeenCalled();
  });
});
