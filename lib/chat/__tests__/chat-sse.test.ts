import { describe, expect, it, vi } from "vitest";

import {
  CursorChatStreamBridge,
  formatToolStageLabel,
  thinkingTextDelta,
} from "@/lib/chat/chat-sse";

describe("formatToolStageLabel", () => {
  it("maps known tools", () => {
    expect(formatToolStageLabel("grep")).toBe("Searching codebase");
    expect(formatToolStageLabel("grep", "done")).toBe("Done: Searching codebase");
  });

  it("title-cases unknown tools", () => {
    expect(formatToolStageLabel("custom_tool")).toBe("Using Custom Tool");
  });
});

describe("thinkingTextDelta", () => {
  it("returns suffix when cumulative", () => {
    expect(thinkingTextDelta("ab", "abcd")).toBe("cd");
  });

  it("replaces when not cumulative", () => {
    expect(thinkingTextDelta("old", "new")).toBe("new");
  });
});

describe("CursorChatStreamBridge", () => {
  it("emits stage, thinking, and text events", () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const bridge = new CursorChatStreamBridge((event, data) => {
      events.push([event, data]);
    });

    bridge.stage("Connecting");
    bridge.handleMessage({
      type: "thinking",
      agent_id: "a",
      run_id: "r",
      text: "Let me check",
    });
    const text = bridge.handleMessage({
      type: "assistant",
      agent_id: "a",
      run_id: "r",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      },
    });

    expect(text).toBe("Hello");
    expect(events.some(([, d]) => d.label === "Connecting")).toBe(true);
    expect(events.some(([e]) => e === "thinking_start")).toBe(true);
    expect(events.some(([e]) => e === "thinking_delta")).toBe(true);
    expect(events.some(([e]) => e === "text_delta")).toBe(true);
    expect(events.some(([e, d]) => e === "stage" && d.label === "Writing response")).toBe(true);
  });

  it("emits tool_call on SDK tool_call message", () => {
    const send = vi.fn();
    const bridge = new CursorChatStreamBridge(send);

    bridge.handleMessage({
      type: "tool_call",
      agent_id: "a",
      run_id: "r",
      call_id: "c1",
      name: "read_file",
      status: "running",
      args: { path: "x.ts" },
    });

    expect(send).toHaveBeenCalledWith(
      "tool_call",
      expect.objectContaining({ id: "c1", name: "read_file", state: "input-streaming" }),
    );
    expect(send).toHaveBeenCalledWith("stage", expect.objectContaining({ label: "Reading file" }));
  });
});
