import type { ToolUIPart } from "ai";

/** Inline MCP / tool invocation shown in assistant bubbles */
export type ChatToolCall = {
  id: string;
  name: string;
  state: ToolUIPart["state"];
  input?: unknown;
  result?: string;
  errorText?: string;
  approval?: {
    id: string;
    approved?: boolean;
    reason?: string;
  };
};

export type ChatSource = {
  href: string;
  title: string;
};

export type ChatPlanBlock = {
  title: string;
  description?: string;
  steps?: Array<{ title: string; items?: string[] }>;
  isStreaming?: boolean;
};

export type ChatTaskBlock = {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
  items?: string[];
};
