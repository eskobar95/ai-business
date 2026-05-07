import { beforeEach, describe, expect, it, vi } from "vitest";

const requireBusinessMemoryExists = vi.hoisted(() => vi.fn());

vi.mock("./queries", () => ({
  requireBusinessMemoryExists,
}));

import { assertBusinessReadyForExecution } from "./readiness-check";

describe("assertBusinessReadyForExecution", () => {
  beforeEach(() => {
    requireBusinessMemoryExists.mockReset();
  });

  it("throws when no business-scope memory exists", async () => {
    requireBusinessMemoryExists.mockResolvedValue(false);

    await expect(assertBusinessReadyForExecution("biz-1", "/repo")).rejects.toThrow(/no memory/u);
  });

  it("throws when local path is unset", async () => {
    requireBusinessMemoryExists.mockResolvedValue(true);

    await expect(assertBusinessReadyForExecution("biz-1", null)).rejects.toThrow(/localPath/u);
    await expect(assertBusinessReadyForExecution("biz-1", "   ")).rejects.toThrow(/localPath/u);
  });

  it("passes when memory and local path are present", async () => {
    requireBusinessMemoryExists.mockResolvedValue(true);

    await expect(assertBusinessReadyForExecution("biz-1", "/repo")).resolves.toBeUndefined();
  });
});
