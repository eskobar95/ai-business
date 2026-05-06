import { beforeEach, describe, expect, it, vi } from "vitest";

const routeCommentToAgents = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("../mention-trigger", () => ({
  routeCommentToAgents,
}));

vi.mock("@/lib/roster/session", () => ({
  requireSessionUserId: vi.fn(async () => "user-1"),
}));

vi.mock("@/lib/grill-me/access", () => ({
  assertUserBusinessAccess: vi.fn(async () => {}),
}));

const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  query: {
    tasks: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/db/index", () => ({
  getDb: () => mockDb,
}));

import { appendTaskLog } from "../log-actions";

describe("log-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.query.tasks.findFirst.mockResolvedValue({ businessId: "b1", agentId: "ag-1" });
    mockDb.insert.mockReturnValue({
      values: () => ({
        returning: vi.fn(async () => [{ id: "log-1" }]),
      }),
    });
  });

  it("appendTaskLog invokes routeCommentToAgents for human authors", async () => {
    await appendTaskLog("task-1", "@alice hi", "human", "user-1");
    expect(routeCommentToAgents).toHaveBeenCalledWith("task-1", "@alice hi", "b1", "ag-1");
  });

  it("appendTaskLog skips comment routing for agent authors", async () => {
    await appendTaskLog("task-1", "@alice hi", "agent", "agent-1");
    expect(routeCommentToAgents).not.toHaveBeenCalled();
  });
});
