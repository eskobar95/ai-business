import { describe, expect, it } from "vitest";

import {
  isAllowedWorkspaceCursorModelId,
  isAllowedWorkspaceThinkingEffort,
} from "@/lib/settings/cursor-workspace-defaults.js";

describe("cursor-workspace-defaults", () => {
  it("allows known model ids", () => {
    expect(isAllowedWorkspaceCursorModelId("auto")).toBe(true);
    expect(isAllowedWorkspaceCursorModelId("gpt-4.1")).toBe(true);
  });

  it("rejects unknown model ids", () => {
    expect(isAllowedWorkspaceCursorModelId("fake-model")).toBe(false);
  });

  it("allows known thinking efforts", () => {
    expect(isAllowedWorkspaceThinkingEffort("high")).toBe(true);
  });

  it("rejects unknown thinking efforts", () => {
    expect(isAllowedWorkspaceThinkingEffort("ultra")).toBe(false);
  });
});
