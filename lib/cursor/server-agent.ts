import { Agent } from "@cursor/sdk";

import { CursorChatStreamBridge } from "@/lib/chat/chat-sse";

/**
 * Runs one non-interactive Cursor Cloud agent turn without `local.cwd`.
 * Used by server actions (PO briefing, EM decomposition) where no checkout exists.
 */
export async function runServerAgentOnce(prompt: string, apiKey: string): Promise<string> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Cursor API key is empty");
  }

  const agentOptions = {
    apiKey: trimmedKey,
    model: { id: "composer-2" as const },
  };

  const cursorAgent = await Agent.create(agentOptions);

  try {
    const run = await cursorAgent.send(prompt);
    const bridge = new CursorChatStreamBridge(() => {});
    let assistantContent = "";

    if (run.supports("stream")) {
      for await (const event of run.stream()) {
        assistantContent += bridge.handleMessage(event);
      }
    } else {
      bridge.stage("Waiting for response");
    }

    bridge.endThinking();

    const result = await run.wait();
    if (!assistantContent.trim() && result.result?.trim()) {
      assistantContent = result.result;
    }

    return assistantContent.trim();
  } finally {
    try {
      await cursorAgent[Symbol.asyncDispose]();
    } catch {
      try {
        cursorAgent.close();
      } catch {
        /* ignore */
      }
    }
  }
}
