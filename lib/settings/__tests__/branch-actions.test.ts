import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn(() => ({
  set: vi.fn(() => ({
    where: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock("@/lib/roster/session", () => ({
  requireSessionUserId: vi.fn(async () => "user-test"),
}));

vi.mock("@/lib/grill-me/access", () => ({
  assertUserBusinessAccess: vi.fn(async () => undefined),
}));

vi.mock("@/db/index", () => ({
  getDb: () => ({
    update: updateMock,
  }),
}));

describe("updateBusinessBranchSettings", () => {
  beforeEach(() => {
    updateMock.mockClear();
  });

  afterEach(() => {
    updateMock.mockClear();
  });

  it("rejects branch names with spaces", async () => {
    const { updateBusinessBranchSettings } = await import("@/lib/settings/branch-actions.js");
    await expect(
      updateBusinessBranchSettings("biz-1", {
        integrationBranch: "stag ing",
        releaseBranch: null,
      }),
    ).rejects.toThrow(/space/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects branch names with invalid characters", async () => {
    const { updateBusinessBranchSettings } = await import("@/lib/settings/branch-actions.js");
    await expect(
      updateBusinessBranchSettings("biz-1", {
        integrationBranch: "foo@bar",
        releaseBranch: null,
      }),
    ).rejects.toThrow(/only contain/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("accepts valid branch names like 'staging' and 'feature/foo'", async () => {
    const { updateBusinessBranchSettings } = await import("@/lib/settings/branch-actions.js");
    await updateBusinessBranchSettings("biz-1", {
      integrationBranch: "staging",
      releaseBranch: "feature/foo",
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("rejects missing integration branch (null / empty)", async () => {
    const { updateBusinessBranchSettings } = await import("@/lib/settings/branch-actions.js");
    await expect(
      updateBusinessBranchSettings("biz-1", {
        integrationBranch: null,
        releaseBranch: null,
      }),
    ).rejects.toThrow(/required/i);
    expect(updateMock).not.toHaveBeenCalled();

    await expect(
      updateBusinessBranchSettings("biz-1", {
        integrationBranch: "   ",
        releaseBranch: null,
      }),
    ).rejects.toThrow(/required/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("allows clearing release branch with valid integration branch", async () => {
    const { updateBusinessBranchSettings } = await import("@/lib/settings/branch-actions.js");
    await updateBusinessBranchSettings("biz-1", {
      integrationBranch: "staging",
      releaseBranch: null,
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});

describe("updateBusinessParallelSettings", () => {
  beforeEach(() => {
    updateMock.mockClear();
  });

  it("accepts null (unlimited)", async () => {
    const { updateBusinessParallelSettings } = await import("@/lib/settings/branch-actions.js");
    await updateBusinessParallelSettings("biz-1", { maxParallelRuns: null });
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("accepts positive integers", async () => {
    const { updateBusinessParallelSettings } = await import("@/lib/settings/branch-actions.js");
    await updateBusinessParallelSettings("biz-1", { maxParallelRuns: 3 });
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("rejects 0 and negative numbers", async () => {
    const { updateBusinessParallelSettings } = await import("@/lib/settings/branch-actions.js");
    await expect(
      updateBusinessParallelSettings("biz-1", { maxParallelRuns: 0 }),
    ).rejects.toThrow();
    expect(updateMock).not.toHaveBeenCalled();
    updateMock.mockClear();
    await expect(
      updateBusinessParallelSettings("biz-1", { maxParallelRuns: -1 }),
    ).rejects.toThrow();
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("updateBusinessCursorDefaults", () => {
  beforeEach(() => {
    updateMock.mockClear();
  });

  it("rejects invalid model id", async () => {
    const { updateBusinessCursorDefaults } = await import("@/lib/settings/branch-actions.js");
    await expect(
      updateBusinessCursorDefaults("biz-1", {
        defaultCursorModelId: "not-a-real-model",
        defaultCursorThinkingEffort: null,
      }),
    ).rejects.toThrow(/invalid cursor model/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects invalid thinking effort", async () => {
    const { updateBusinessCursorDefaults } = await import("@/lib/settings/branch-actions.js");
    await expect(
      updateBusinessCursorDefaults("biz-1", {
        defaultCursorModelId: null,
        defaultCursorThinkingEffort: "ultra",
      }),
    ).rejects.toThrow(/invalid cursor thinking effort/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("accepts null and allowlisted values", async () => {
    const { updateBusinessCursorDefaults } = await import("@/lib/settings/branch-actions.js");
    await updateBusinessCursorDefaults("biz-1", {
      defaultCursorModelId: "auto",
      defaultCursorThinkingEffort: "high",
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});
