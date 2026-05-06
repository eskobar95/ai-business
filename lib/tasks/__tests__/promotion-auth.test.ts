import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  query: {
    tasks: { findFirst: vi.fn() },
    agents: { findFirst: vi.fn() },
    teams: { findFirst: vi.fn() },
  },
}));

vi.mock("@/db/index", () => ({
  getDb: () => mockDb,
}));

import { assertMayPromoteToTodo } from "../promotion-auth";

describe("assertMayPromoteToTodo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows human callers unconditionally", async () => {
    await expect(assertMayPromoteToTodo("task-1", "any-user", "human")).resolves.toBeUndefined();
    expect(mockDb.query.tasks.findFirst).not.toHaveBeenCalled();
  });

  it("allows agent with system_role.mayPromoteBacklogToTodo=true", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValue({ businessId: "b1", teamId: "team-1" });
    mockDb.query.agents.findFirst.mockResolvedValue({
      systemRole: { mayPromoteBacklogToTodo: true, slug: "engineering_manager" },
    });

    await expect(assertMayPromoteToTodo("task-1", "agent-1", "agent")).resolves.toBeUndefined();
    expect(mockDb.query.teams.findFirst).not.toHaveBeenCalled();
  });

  it("allows agent that is leadAgentId on task's team", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValue({ businessId: "b1", teamId: "team-1" });
    mockDb.query.agents.findFirst.mockResolvedValue({
      systemRole: { mayPromoteBacklogToTodo: false, slug: "worker" },
    });
    mockDb.query.teams.findFirst.mockResolvedValue({ leadAgentId: "agent-lead" });

    await expect(assertMayPromoteToTodo("task-1", "agent-lead", "agent")).resolves.toBeUndefined();
  });

  it("rejects agent with worker role (no promotion flag)", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValue({ businessId: "b1", teamId: "team-1" });
    mockDb.query.agents.findFirst.mockResolvedValue({
      systemRole: { mayPromoteBacklogToTodo: false, slug: "worker" },
    });
    mockDb.query.teams.findFirst.mockResolvedValue({ leadAgentId: "someone-else" });

    await expect(assertMayPromoteToTodo("task-1", "agent-worker", "agent")).rejects.toThrow(
      "Agent is not authorized to promote tasks to todo",
    );
  });

  it("rejects agent from different business", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValue({ businessId: "b1", teamId: null });
    mockDb.query.agents.findFirst.mockResolvedValue(undefined);

    await expect(assertMayPromoteToTodo("task-1", "agent-outside", "agent")).rejects.toThrow(
      "Agent not found in this business",
    );
  });

  it("rejects when task has no team and agent has no promotion flag", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValue({ businessId: "b1", teamId: null });
    mockDb.query.agents.findFirst.mockResolvedValue({
      systemRole: { mayPromoteBacklogToTodo: false, slug: "worker" },
    });

    await expect(assertMayPromoteToTodo("task-1", "agent-1", "agent")).rejects.toThrow(
      "Agent is not authorized to promote tasks to todo",
    );
    expect(mockDb.query.teams.findFirst).not.toHaveBeenCalled();
  });
});
