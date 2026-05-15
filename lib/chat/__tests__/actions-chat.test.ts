import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chatMocks = vi.hoisted(() => {
  const insertReturning = vi.fn();
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insertFn = vi.fn(() => ({ values: insertValues }));

  const updateWhere = vi.fn(() => Promise.resolve());
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const updateFn = vi.fn(() => ({ set: updateSet }));

  const findFirstAgent = vi.fn(async (): Promise<{ name: string } | undefined> => ({ name: "Ada" }));
  const findFirstSession = vi.fn(async (): Promise<{ businessId: string } | undefined> => ({ businessId: "biz-1" }));
  const findManySessions = vi.fn(async () => [] as unknown[]);

  return {
    insertReturning,
    insertValues,
    insertFn,
    updateWhere,
    updateSet,
    updateFn,
    findFirstAgent,
    findFirstSession,
    findManySessions,
  };
});

vi.mock("@/lib/roster/session", () => ({
  requireSessionUserId: vi.fn(async () => "test-user"),
}));

vi.mock("@/lib/business/ensure", () => ({
  ensureBusiness: vi.fn(async () => {}),
}));

vi.mock("@/db/index", () => ({
  getDb: () => ({
    query: {
      agents: {
        findFirst: chatMocks.findFirstAgent,
      },
      chatSessions: {
        findFirst: chatMocks.findFirstSession,
        findMany: chatMocks.findManySessions,
      },
    },
    insert: chatMocks.insertFn,
    update: chatMocks.updateFn,
  }),
}));

describe("chat actions", () => {
  beforeEach(() => {
    chatMocks.insertReturning.mockReset();
    chatMocks.insertValues.mockClear();
    chatMocks.insertFn.mockClear();
    chatMocks.updateWhere.mockClear();
    chatMocks.updateSet.mockClear();
    chatMocks.updateFn.mockClear();
    chatMocks.findFirstAgent.mockReset();
    chatMocks.findFirstSession.mockReset();
    chatMocks.findManySessions.mockReset();

    chatMocks.insertReturning.mockResolvedValue([{ id: "new-session-id" }]);
    chatMocks.findFirstAgent.mockResolvedValue({ name: "Ada" });
    chatMocks.findFirstSession.mockResolvedValue({ businessId: "biz-1" });
    chatMocks.findManySessions.mockResolvedValue([
      {
        id: "s1",
        title: "Chat with Ada",
        agent: { name: "Ada", slug: "ada", isPlatformDefault: false },
      },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("createChatSession inserts and returns id", async () => {
    const { createChatSession } = await import("@/lib/chat/actions.js");
    const r = await createChatSession("biz-1", "agent-1");
    expect(r).toEqual({ id: "new-session-id" });
    expect(chatMocks.findFirstAgent).toHaveBeenCalled();
    expect(chatMocks.insertReturning).toHaveBeenCalled();
  });

  it("createChatSession throws when agent is missing", async () => {
    chatMocks.findFirstAgent.mockResolvedValueOnce(undefined);
    const { createChatSession } = await import("@/lib/chat/actions.js");
    await expect(createChatSession("biz-1", "bad-agent")).rejects.toThrow("Agent not found");
  });

  it("saveChatMessage inserts message and bumps session updatedAt", async () => {
    const { saveChatMessage } = await import("@/lib/chat/actions.js");
    await saveChatMessage("sess-1", "user", "hello", { type: "text" });

    expect(chatMocks.insertFn).toHaveBeenCalled();
    expect(chatMocks.insertValues).toHaveBeenCalledWith({
      sessionId: "sess-1",
      role: "user",
      content: "hello",
      metadata: { type: "text" },
    });
    expect(chatMocks.updateFn).toHaveBeenCalled();
    expect(chatMocks.updateSet).toHaveBeenCalledWith({ updatedAt: expect.any(Date) });
  });

  it("listChatSessions returns rows for business", async () => {
    const { listChatSessions } = await import("@/lib/chat/actions.js");
    const rows = await listChatSessions("biz-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Chat with Ada");
    expect(chatMocks.findManySessions).toHaveBeenCalled();
  });
});
