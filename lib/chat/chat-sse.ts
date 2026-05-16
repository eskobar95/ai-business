import type { SDKAssistantMessage, SDKMessage, SDKToolUseMessage } from "@cursor/sdk";
import type { ToolUIPart } from "ai";

/** Human-readable labels for Cursor SDK tool names in the processing trail. */
const TOOL_STAGE_LABELS: Record<string, string> = {
  read_file: "Reading file",
  list_dir: "Listing directory",
  grep: "Searching codebase",
  codebase_search: "Searching codebase",
  glob_file_search: "Finding files",
  run_terminal_cmd: "Running command",
  web_search: "Searching the web",
  fetch_rules: "Loading rules",
  edit_file: "Editing file",
  search_replace: "Updating file",
  write: "Writing file",
  delete_file: "Deleting file",
  mcp: "Calling integration",
};

export function formatToolStageLabel(toolName: string, phase: "running" | "done" = "running"): string {
  const key = toolName.trim().toLowerCase();
  const base =
    TOOL_STAGE_LABELS[key] ??
    `Using ${toolName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;
  return phase === "done" ? `Done: ${base}` : base;
}

export function mapToolCallState(
  status: SDKToolUseMessage["status"],
): ToolUIPart["state"] {
  switch (status) {
    case "running":
      return "input-streaming";
    case "completed":
      return "output-available";
    case "error":
      return "output-error";
    default:
      return "input-available";
  }
}

export function thinkingTextDelta(previous: string, next: string): string {
  if (!next) return "";
  if (!previous) return next;
  if (next.startsWith(previous)) return next.slice(previous.length);
  return next;
}

export type ChatSseSend = (event: string, data: Record<string, unknown>) => void;

/**
 * Maps Cursor SDK stream messages to chat SSE events (`stage`, `thinking_*`, `text_delta`, `tool_call`).
 */
export class CursorChatStreamBridge {
  private thinkingBuf = "";
  private thinkingStarted = false;
  private writingStageSent = false;

  constructor(private readonly send: ChatSseSend) {}

  stage(label: string) {
    this.send("stage", { label });
  }

  endThinking() {
    if (!this.thinkingStarted) return;
    this.send("thinking_end", {});
    this.thinkingStarted = false;
  }

  private beginThinking() {
    if (this.thinkingStarted) return;
    this.send("thinking_start", {});
    this.thinkingStarted = true;
  }

  private pushThinking(text: string) {
    const delta = thinkingTextDelta(this.thinkingBuf, text);
    if (!delta && !this.thinkingStarted) return;
    this.beginThinking();
    if (delta) {
      this.send("thinking_delta", { delta });
      this.thinkingBuf = text;
    }
  }

  private emitToolCall(msg: SDKToolUseMessage) {
    const state = mapToolCallState(msg.status);
    this.send("tool_call", {
      id: msg.call_id,
      name: msg.name,
      state,
      input: msg.args,
      result:
        msg.result !== undefined
          ? typeof msg.result === "string"
            ? msg.result
            : JSON.stringify(msg.result)
          : undefined,
      errorText: msg.status === "error" ? "Tool failed" : undefined,
    });
  }

  private ensureWritingStage() {
    if (this.writingStageSent) return;
    this.writingStageSent = true;
    this.endThinking();
    this.stage("Writing response");
  }

  /** @returns assistant text appended from this message (for persistence). */
  handleMessage(msg: SDKMessage): string {
    switch (msg.type) {
      case "thinking":
        this.pushThinking(msg.text);
        if (!this.writingStageSent) {
          this.stage("Reasoning");
        }
        return "";

      case "tool_call": {
        const phase = msg.status === "completed" || msg.status === "error" ? "done" : "running";
        this.stage(formatToolStageLabel(msg.name, phase));
        this.emitToolCall(msg);
        return "";
      }

      case "task":
        if (msg.text?.trim()) this.stage(msg.text.trim());
        return "";

      case "status":
        if (msg.message?.trim()) this.stage(msg.message.trim());
        return "";

      case "assistant":
        return this.handleAssistant(msg);

      default:
        return "";
    }
  }

  private handleAssistant(msg: SDKAssistantMessage): string {
    let appended = "";
    for (const block of msg.message.content) {
      if (block.type === "tool_use") {
        this.stage(formatToolStageLabel(block.name, "running"));
        this.send("tool_call", {
          id: block.id,
          name: block.name,
          state: "input-available" as ToolUIPart["state"],
          input: block.input,
        });
        continue;
      }
      if (block.type === "text" && block.text) {
        this.ensureWritingStage();
        appended += block.text;
        this.send("text_delta", { delta: block.text });
      }
    }
    return appended;
  }
}
