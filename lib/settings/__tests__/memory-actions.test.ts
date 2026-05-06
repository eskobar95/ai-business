import { beforeEach, describe, expect, it, vi } from "vitest";

const memoryFindFirst = vi.fn();
const updateChain = {
  set: vi.fn(() => ({
    where: vi.fn(() => Promise.resolve()),
  })),
};
const updateMock = vi.fn(() => updateChain);
const returningMock = vi.fn(() => Promise.resolve([{ id: "new-memory-id" }]));
const insertValuesMock = vi.fn(() => ({
  returning: returningMock,
}));
const insertMock = vi.fn(() => ({
  values: insertValuesMock,
}));

vi.mock("@/lib/roster/session", () => ({
  requireSessionUserId: vi.fn(async () => "user-test"),
}));

vi.mock("@/lib/grill-me/access", () => ({
  assertUserBusinessAccess: vi.fn(async () => undefined),
}));

vi.mock("@/db/index", () => ({
  getDb: () => ({
    query: {
      memory: {
        findFirst: memoryFindFirst,
      },
    },
    update: updateMock,
    insert: insertMock,
  }),
}));

describe("updateMemoryContent", () => {
  beforeEach(() => {
    memoryFindFirst.mockReset();
    updateMock.mockClear();
    updateChain.set.mockClear();
    updateChain.set.mockReturnValue({ where: vi.fn(() => Promise.resolve()) });
  });

  it("throws when memory row is missing or filtered out (e.g. agent-bound)", async () => {
    memoryFindFirst.mockResolvedValue(undefined);
    const { updateMemoryContent } = await import("@/lib/settings/memory-actions.js");
    await expect(updateMemoryContent("mem-1", "<p>x</p>")).rejects.toThrow(
      /memory section not found/i,
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("throws for non-business scope", async () => {
    memoryFindFirst.mockResolvedValue({
      id: "mem-1",
      businessId: "biz-1",
      scope: "agent",
      version: 1,
    });
    const { updateMemoryContent } = await import("@/lib/settings/memory-actions.js");
    await expect(updateMemoryContent("mem-1", "<p>x</p>")).rejects.toThrow(/only business memory/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates when business-scope row exists", async () => {
    memoryFindFirst.mockResolvedValue({
      id: "mem-1",
      businessId: "biz-1",
      scope: "business",
      version: 2,
    });
    const { updateMemoryContent } = await import("@/lib/settings/memory-actions.js");
    await updateMemoryContent("mem-1", "<p>hi</p>");
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "<p>hi</p>",
        version: 3,
      }),
    );
  });
});

describe("createBusinessMemorySection", () => {
  beforeEach(() => {
    insertMock.mockClear();
    insertValuesMock.mockClear();
    returningMock.mockClear();
    returningMock.mockResolvedValue([{ id: "new-memory-id" }]);
  });

  it("returns new id", async () => {
    const { createBusinessMemorySection } = await import("@/lib/settings/memory-actions.js");
    const out = await createBusinessMemorySection("biz-1");
    expect(out).toEqual({ id: "new-memory-id" });
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});
