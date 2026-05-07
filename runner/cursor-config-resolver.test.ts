import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstAgent = vi.fn();
const findFirstBusiness = vi.fn();

vi.mock("@/db/index", () => ({
  getDb: () => ({
    query: {
      agents: { findFirst: findFirstAgent },
      businesses: { findFirst: findFirstBusiness },
    },
  }),
}));

import { resolveCursorConfig } from "./cursor-config-resolver";

describe("resolveCursorConfig", () => {
  beforeEach(() => {
    findFirstAgent.mockReset();
    findFirstBusiness.mockReset();
  });
  it("returns undefined for model when agent is 'auto'", async () => {
    findFirstAgent.mockResolvedValueOnce({ cursorModelId: "auto", cursorThinkingEffort: "auto" });
    findFirstBusiness.mockResolvedValueOnce({});

    const cfg = await resolveCursorConfig("agent-1", "biz-1");

    expect(cfg.modelId).toBeUndefined();
    expect(cfg.thinkingEffort).toBeUndefined();
  });

  it("returns undefined for model when agent is 'inherit' and business has no override", async () => {
    findFirstAgent.mockResolvedValueOnce({ cursorModelId: "inherit", cursorThinkingEffort: "inherit" });
    findFirstBusiness.mockResolvedValueOnce({
      defaultCursorModelId: null,
      defaultCursorThinkingEffort: null,
    });

    const cfg = await resolveCursorConfig("agent-1", "biz-1");

    expect(cfg.modelId).toBe("composer-2");
    expect(cfg.thinkingEffort).toBeUndefined();
  });

  it("returns business model when agent is 'inherit' and business sets a concrete slug", async () => {
    findFirstAgent.mockResolvedValueOnce({
      cursorModelId: "inherit",
      cursorThinkingEffort: "inherit",
    });
    findFirstBusiness.mockResolvedValueOnce({
      defaultCursorModelId: "claude-opus-4",
      defaultCursorThinkingEffort: "medium",
    });

    const cfg = await resolveCursorConfig("agent-1", "biz-1");

    expect(cfg.modelId).toBe("claude-opus-4");
    expect(cfg.thinkingEffort).toBe("medium");
  });

  it("returns concrete agent slugs directly", async () => {
    findFirstAgent.mockResolvedValueOnce({
      cursorModelId: "gpt-5.2-codex",
      cursorThinkingEffort: "high",
    });
    findFirstBusiness.mockResolvedValueOnce({});

    const cfg = await resolveCursorConfig("agent-1", "biz-1");

    expect(cfg.modelId).toBe("gpt-5.2-codex");
    expect(cfg.thinkingEffort).toBe("high");
  });

  it("uses platform composer default when agent inherits unset business overrides", async () => {
    findFirstAgent.mockResolvedValueOnce({
      cursorModelId: "inherit",
      cursorThinkingEffort: "inherit",
    });
    findFirstBusiness.mockResolvedValueOnce({
      defaultCursorModelId: "auto",
      defaultCursorThinkingEffort: "auto",
    });

    const cfg = await resolveCursorConfig("agent-1", "biz-1");

    expect(cfg.modelId).toBe("composer-2");
    expect(cfg.thinkingEffort).toBeUndefined();
  });
});
