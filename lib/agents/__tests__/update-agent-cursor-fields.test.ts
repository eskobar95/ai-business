import { describe, expect, it } from "vitest";

import {
  assertValidAgentCursorPatchFields,
  HEARTBEAT_PROMOTION_CAP_DEFAULT,
  HEARTBEAT_PROMOTION_CAP_MAX,
  parseHeartbeatPromotionCapFromForm,
} from "@/lib/agents/cursor-agent-config";

/**
 * `updateAgent` calls this before persisting Cursor-related columns.
 * Tests mirror the Server Action contract for cursor fields.
 */
describe("updateAgent — Cursor fields", () => {
  it("accepts valid cursorModelId values", () => {
    const valid = [
      "auto",
      "inherit",
      "composer-2",
      "claude-sonnet-4",
      "claude-opus-4",
      "gpt-4.1",
      "gemini-2.5-pro",
    ] as const;
    for (const cursorModelId of valid) {
      expect(() => assertValidAgentCursorPatchFields({ cursorModelId })).not.toThrow();
    }
  });

  it("rejects invalid cursorModelId", () => {
    expect(() => assertValidAgentCursorPatchFields({ cursorModelId: "not-a-model" })).toThrow(
      /Invalid cursorModelId/,
    );
  });

  it("accepts valid cursorThinkingEffort values", () => {
    const valid = ["auto", "inherit", "low", "medium", "high"] as const;
    for (const cursorThinkingEffort of valid) {
      expect(() =>
        assertValidAgentCursorPatchFields({ cursorThinkingEffort }),
      ).not.toThrow();
    }
  });

  it("rejects invalid cursorThinkingEffort", () => {
    expect(() =>
      assertValidAgentCursorPatchFields({ cursorThinkingEffort: "extreme" }),
    ).toThrow(/Invalid cursorThinkingEffort/);
  });

  it("accepts heartbeatPromotionCap in allowed range", () => {
    expect(() => assertValidAgentCursorPatchFields({ heartbeatPromotionCap: 1 })).not.toThrow();
    expect(() =>
      assertValidAgentCursorPatchFields({ heartbeatPromotionCap: HEARTBEAT_PROMOTION_CAP_MAX }),
    ).not.toThrow();
  });

  it("rejects heartbeatPromotionCap = 0", () => {
    expect(() => assertValidAgentCursorPatchFields({ heartbeatPromotionCap: 0 })).toThrow(
      /heartbeatPromotionCap must be a positive integer/,
    );
  });

  it("rejects heartbeatPromotionCap above max", () => {
    expect(() =>
      assertValidAgentCursorPatchFields({ heartbeatPromotionCap: HEARTBEAT_PROMOTION_CAP_MAX + 1 }),
    ).toThrow(/at most/);
  });

  it("rejects non-integer heartbeatPromotionCap", () => {
    expect(() =>
      assertValidAgentCursorPatchFields({ heartbeatPromotionCap: 1.5 as unknown as number }),
    ).toThrow(/heartbeatPromotionCap must be a positive integer/);
  });
});

describe("parseHeartbeatPromotionCapFromForm", () => {
  it("returns default for empty or invalid input", () => {
    expect(parseHeartbeatPromotionCapFromForm("")).toBe(HEARTBEAT_PROMOTION_CAP_DEFAULT);
    expect(parseHeartbeatPromotionCapFromForm("  ")).toBe(HEARTBEAT_PROMOTION_CAP_DEFAULT);
    expect(parseHeartbeatPromotionCapFromForm("abc")).toBe(HEARTBEAT_PROMOTION_CAP_DEFAULT);
  });

  it("clamps to min and max", () => {
    expect(parseHeartbeatPromotionCapFromForm("0")).toBe(1);
    expect(parseHeartbeatPromotionCapFromForm("999")).toBe(HEARTBEAT_PROMOTION_CAP_MAX);
  });

  it("accepts values in range", () => {
    expect(parseHeartbeatPromotionCapFromForm("7")).toBe(7);
    expect(parseHeartbeatPromotionCapFromForm(String(HEARTBEAT_PROMOTION_CAP_MAX))).toBe(
      HEARTBEAT_PROMOTION_CAP_MAX,
    );
  });
});
