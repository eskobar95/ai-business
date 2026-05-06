import { beforeEach, describe, expect, it, vi } from "vitest";

const memoryFindFirst = vi.fn();

const updateReturningMock = vi.fn(() => Promise.resolve([{ id: "mem-1" }]));
const updateWhereMock = vi.fn(() => ({
  returning: updateReturningMock,
}));
const updateSetMock = vi.fn(() => ({
  where: updateWhereMock,
}));
const updateMock = vi.fn(() => ({
  set: updateSetMock,
}));

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
    updateSetMock.mockClear();
    updateWhereMock.mockClear();
    updateReturningMock.mockReset();
    updateReturningMock.mockResolvedValue([{ id: "mem-1" }]);
  });

  it("throws when memory row is missing or not business-scoped without agent binding", async () => {
    memoryFindFirst.mockResolvedValue(undefined);
    const { updateMemoryContent } = await import("@/lib/settings/memory-actions.js");
    await expect(updateMemoryContent("mem-1", "<p>x</p>")).rejects.toThrow(
      /memory section not found/i,
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("throws when optimistic lock fails (concurrent update)", async () => {
    memoryFindFirst.mockResolvedValue({
      id: "mem-1",
      businessId: "biz-1",
      version: 2,
    });
    updateReturningMock.mockResolvedValueOnce([]);
    const { updateMemoryContent } = await import("@/lib/settings/memory-actions.js");
    await expect(updateMemoryContent("mem-1", "<p>hi</p>")).rejects.toThrow(/updated elsewhere/i);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("updates when business-scope row exists and version matches", async () => {
    memoryFindFirst.mockResolvedValue({
      id: "mem-1",
      businessId: "biz-1",
      version: 2,
    });
    const { updateMemoryContent } = await import("@/lib/settings/memory-actions.js");
    await updateMemoryContent("mem-1", "<p>hi</p>");
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateSetMock).toHaveBeenCalledWith(
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
