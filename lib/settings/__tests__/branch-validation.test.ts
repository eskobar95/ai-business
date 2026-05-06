import { describe, expect, it } from "vitest";

import {
  assertValidOptionalBranchField,
  normalizeBranchValue,
} from "@/lib/settings/branch-validation.js";

describe("branch-validation", () => {
  it("normalizeBranchValue trims and maps empty to null", () => {
    expect(normalizeBranchValue("  main  ")).toBe("main");
    expect(normalizeBranchValue("")).toBeNull();
    expect(normalizeBranchValue("   ")).toBeNull();
    expect(normalizeBranchValue(null)).toBeNull();
  });

  it("assertValidOptionalBranchField allows null", () => {
    expect(() => assertValidOptionalBranchField("Release", null)).not.toThrow();
  });

  it("assertValidOptionalBranchField rejects invalid", () => {
    expect(() => assertValidOptionalBranchField("X", "bad name")).toThrow(/space/i);
    expect(() => assertValidOptionalBranchField("X", "a\\b")).toThrow(/only contain/i);
  });
});
