import { beforeEach, describe, expect, it, vi } from "vitest";

const logEvent = vi.hoisted(() =>
  vi.fn(async () => {
    return "evt-1";
  }),
);

vi.mock("@/lib/orchestration/events", () => ({
  logEvent,
}));

const findManyAgents = vi.hoisted(() => vi.fn(async () => [{ id: "agent-alice" }]));

vi.mock("@/db/index", () => ({
  getDb() {
    return {
      query: {
        agents: {
          findMany: findManyAgents,
        },
      },
    };
  },
}));

import { extractMentionHandles, routeCommentToAgents } from "../mention-trigger";

describe("mention-trigger", () => {
  beforeEach(() => {
    logEvent.mockClear();
    findManyAgents.mockReset();
    findManyAgents.mockResolvedValue([{ id: "agent-alice" }]);
  });

  it("extractMentionHandles dedupes case-insensitively", () => {
    expect(extractMentionHandles("Ping @Alice and @alice once")).toEqual(["Alice"]);
  });

  describe("routeCommentToAgents", () => {
    it("creates webhook_trigger for assigned agent when no mentions", async () => {
      await routeCommentToAgents("task-1", "please review", "biz-1", "agent-worker");
      expect(findManyAgents).not.toHaveBeenCalled();
      expect(logEvent).toHaveBeenCalledTimes(1);
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "webhook_trigger",
          businessId: "biz-1",
          status: "pending",
          payload: {
            agentId: "agent-worker",
            taskId: "task-1",
            trigger: "comment_no_mention",
            excerpt: "please review",
          },
        }),
      );
    });

    it("does nothing when no mentions and no assigned agent", async () => {
      await routeCommentToAgents("task-1", "hello", "biz-1", null);
      expect(logEvent).not.toHaveBeenCalled();
      expect(findManyAgents).not.toHaveBeenCalled();
    });

    it("creates webhook_trigger for each mentioned agent", async () => {
      findManyAgents
        .mockResolvedValueOnce([{ id: "agent-alice" }])
        .mockResolvedValueOnce([{ id: "agent-bob" }]);

      await routeCommentToAgents("task-1", "@alice and @bob please", "biz-1", "agent-worker");

      expect(logEvent).toHaveBeenCalledTimes(2);
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            agentId: "agent-alice",
            trigger: "comment_mention",
            mentionedHandle: "alice",
          }),
        }),
      );
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            agentId: "agent-bob",
            trigger: "comment_mention",
            mentionedHandle: "bob",
          }),
        }),
      );
    });

    it("creates webhook_trigger for worker if explicitly @mentioned alongside others", async () => {
      findManyAgents
        .mockResolvedValueOnce([{ id: "agent-alice" }])
        .mockResolvedValueOnce([{ id: "agent-worker" }]);

      await routeCommentToAgents("task-1", "@alice @worker check this", "biz-1", "agent-worker");

      expect(logEvent).toHaveBeenCalledTimes(2);
      const calls = logEvent.mock.calls as unknown as Array<[{ payload: { agentId: string } }]>;
      const ids = calls.map((c) => c[0].payload.agentId);
      expect(ids).toContain("agent-alice");
      expect(ids).toContain("agent-worker");
    });

    it("deduplicates if same agent matched by multiple handles", async () => {
      findManyAgents
        .mockResolvedValueOnce([{ id: "agent-same" }])
        .mockResolvedValueOnce([{ id: "agent-same" }]);

      await routeCommentToAgents("task-1", "@foo @bar same", "biz-1", null);

      expect(logEvent).toHaveBeenCalledTimes(1);
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ agentId: "agent-same", trigger: "comment_mention" }),
        }),
      );
    });

    it("does NOT trigger assigned agent when others are mentioned (no extra event)", async () => {
      findManyAgents.mockResolvedValueOnce([{ id: "agent-alice" }]);

      await routeCommentToAgents("task-1", "@alice only you", "biz-1", "agent-worker");

      expect(logEvent).toHaveBeenCalledTimes(1);
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            agentId: "agent-alice",
            trigger: "comment_mention",
          }),
        }),
      );
    });
  });
});
