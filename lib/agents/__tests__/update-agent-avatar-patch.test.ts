import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstAgent = vi.fn();
const findManySoul = vi.fn();
const updateReturning = vi.fn();
let lastSetPayload: Record<string, unknown> | undefined;

vi.mock("@/lib/roster/session", () => ({
  requireSessionUserId: vi.fn().mockResolvedValue("user-1"),
}));

vi.mock("@/lib/grill-me/access", () => ({
  assertUserBusinessAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/db/index", () => ({
  getDb: () => ({
    query: {
      agents: { findFirst: findFirstAgent },
      agentDocuments: { findMany: findManySoul },
    },
    update: vi.fn(() => {
      const chain = {
        set(payload: Record<string, unknown>) {
          lastSetPayload = payload;
          return chain;
        },
        where() {
          return chain;
        },
        returning: updateReturning,
      };
      return chain;
    }),
  }),
}));

import { updateAgent, updateAgentAvatar } from "../actions";

describe("updateAgent — avatar and iconKey", () => {
  beforeEach(() => {
    findFirstAgent.mockReset();
    findManySoul.mockReset();
    updateReturning.mockReset();
    lastSetPayload = undefined;
    findFirstAgent.mockResolvedValue({ businessId: "b1" });
    findManySoul.mockResolvedValue([{ content: "soul" }]);
    updateReturning.mockResolvedValue([
      {
        id: "a1",
        businessId: "b1",
        name: "Agent",
        role: "Role",
        slug: "agent",
        archetypeId: null,
        systemRoleId: null,
        executionAdapter: "cursor_cli_local",
        modelRouting: null,
        tier: null,
        avatarUrl: null,
        iconKey: null,
        reportsToAgentId: null,
        cursorModelId: "auto",
        cursorThinkingEffort: "auto",
        cursorRuntimeProfile: null,
        heartbeatPromotionCap: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  it("merges resolved avatar columns into a single agents.update", async () => {
    const dataUrl = "data:image/png;base64," + "a".repeat(200);
    await updateAgent("a1", {
      iconKey: "bot",
      avatarUrl: dataUrl,
    });

    expect(lastSetPayload).toMatchObject({
      iconKey: "bot",
      avatarUrl: expect.stringContaining("data:image/png"),
    });
    expect(updateReturning).toHaveBeenCalledOnce();
  });

  it("updateAgentAvatar delegates to updateAgent", async () => {
    const dataUrl = "data:image/png;base64," + "b".repeat(200);
    await updateAgentAvatar("a1", { avatarUrl: dataUrl, iconKey: null });

    expect(lastSetPayload).toMatchObject({
      avatarUrl: expect.stringContaining("data:image/png"),
      iconKey: null,
    });
  });

  it("updateAgentAvatar no-ops when patch has no fields to apply", async () => {
    await updateAgentAvatar("a1", {});

    expect(updateReturning).not.toHaveBeenCalled();
  });
});
