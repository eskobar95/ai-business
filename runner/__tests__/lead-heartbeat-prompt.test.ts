import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstAgent = vi.fn();
const getLatestBusinessMemoryContentMock = vi.hoisted(() => vi.fn());

vi.mock("@/db/index", () => ({
  getDb: () => ({
    query: {
      agents: { findFirst: findFirstAgent },
    },
  }),
}));

vi.mock("../queries", () => ({
  getLatestBusinessMemoryContent: getLatestBusinessMemoryContentMock,
}));

import { buildLeadHeartbeatPrompt } from "../lead-heartbeat-prompt";

const baseTask = {
  id: "task-a1111111-1111-4111-8111-111111111111",
  title: "Example",
  description: null as string | null,
  dependencyTaskId: null as string | null,
  dependencyBlocksPromotion: false,
  githubPrNumber: null as number | null,
  prMergedToIntegration: false,
  agentId: null as string | null,
};

describe("buildLeadHeartbeatPrompt", () => {
  beforeEach(() => {
    findFirstAgent.mockReset();
    getLatestBusinessMemoryContentMock.mockReset();
    findFirstAgent.mockResolvedValue({
      name: "LeadBot",
      role: "Lead",
      documents: [{ content: "I am the soul." }],
    });
    getLatestBusinessMemoryContentMock.mockResolvedValue("Business memory markdown.");
  });

  it("marks tasks with dependencies as BLOCKED", async () => {
    const depId = "task-dep11111-1111-4111-8111-111111111111";
    const out = await buildLeadHeartbeatPrompt({
      agentId: "agent-1",
      businessId: "biz-1",
      backlogTasks: [{ ...baseTask, dependencyTaskId: depId, dependencyBlocksPromotion: true }],
    });
    expect(out).toContain("[BLOCKED:");
    expect(out).toContain(`depends on task ${depId}`);
  });

  it("does not mark dependency as BLOCKED when dependency is satisfied (done)", async () => {
    const depId = "task-dep11111-1111-4111-8111-111111111111";
    const out = await buildLeadHeartbeatPrompt({
      agentId: "agent-1",
      businessId: "biz-1",
      backlogTasks: [{ ...baseTask, dependencyTaskId: depId, dependencyBlocksPromotion: false }],
    });
    expect(out).toContain("[READY]");
    expect(out).not.toContain(`depends on task ${depId}`);
  });

  it("marks tasks with unmerged PRs as BLOCKED", async () => {
    const out = await buildLeadHeartbeatPrompt({
      agentId: "agent-1",
      businessId: "biz-1",
      backlogTasks: [
        { ...baseTask, githubPrNumber: 42, prMergedToIntegration: false },
      ],
    });
    expect(out).toContain("[BLOCKED:");
    expect(out).toContain("PR #42 not merged");
  });

  it("marks tasks with no gates as READY", async () => {
    const out = await buildLeadHeartbeatPrompt({
      agentId: "agent-1",
      businessId: "biz-1",
      backlogTasks: [{ ...baseTask }],
    });
    expect(out).toContain("[READY]");
    expect(out).not.toContain("[BLOCKED:");
  });

  it("includes agent soul and business memory in output", async () => {
    const out = await buildLeadHeartbeatPrompt({
      agentId: "agent-1",
      businessId: "biz-1",
      backlogTasks: [],
    });
    expect(out).toContain("I am the soul.");
    expect(out).toContain("Business memory markdown.");
    expect(out).toContain("LeadBot");
  });

  it("shows empty backlog line when no backlog", async () => {
    const out = await buildLeadHeartbeatPrompt({
      agentId: "agent-1",
      businessId: "biz-1",
      backlogTasks: [],
    });
    expect(out).toContain("(No backlog tasks found)");
  });
});
