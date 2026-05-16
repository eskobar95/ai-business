import { afterEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();

vi.mock("@cursor/sdk", () => ({
  Agent: {
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

describe("runServerAgentOnce", () => {
  afterEach(() => {
    mockCreate.mockReset();
    vi.resetModules();
  });

  it("aggregates streamed assistant text deltas", async () => {
    async function* fakeStream() {
      yield {
        type: "assistant" as const,
        message: {
          content: [{ type: "text" as const, text: "Hello " }],
        },
      };
      yield {
        type: "assistant" as const,
        message: {
          content: [{ type: "text" as const, text: "world" }],
        },
      };
    }

    const fakeAgent = {
      send: vi.fn().mockResolvedValue({
        supports: () => true,
        stream: fakeStream,
        wait: vi.fn().mockResolvedValue({ status: "finished", result: "" }),
      }),
      close: vi.fn(),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    };

    mockCreate.mockResolvedValue(fakeAgent);

    const { runServerAgentOnce } = await import("@/lib/cursor/server-agent.js");
    const out = await runServerAgentOnce("prompt text", "sk-test");

    expect(mockCreate).toHaveBeenCalledWith({
      apiKey: "sk-test",
      model: { id: "composer-2" },
    });
    expect(out).toBe("Hello world");
    expect(fakeAgent[Symbol.asyncDispose]).toHaveBeenCalled();
  });

  it("uses wait().result when stream yields no assistant text", async () => {
    async function* emptyStream() {
      yield { type: "status" as const, message: "ok" };
    }

    const fakeAgent = {
      send: vi.fn().mockResolvedValue({
        supports: () => true,
        stream: emptyStream,
        wait: vi.fn().mockResolvedValue({ status: "finished", result: "fallback body" }),
      }),
      close: vi.fn(),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    };

    mockCreate.mockResolvedValue(fakeAgent);

    const { runServerAgentOnce } = await import("@/lib/cursor/server-agent.js");
    const out = await runServerAgentOnce("x", "sk-test");

    expect(out).toBe("fallback body");
  });

  it("throws on empty API key", async () => {
    const { runServerAgentOnce } = await import("@/lib/cursor/server-agent.js");
    await expect(runServerAgentOnce("x", "   ")).rejects.toThrow(/empty/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
