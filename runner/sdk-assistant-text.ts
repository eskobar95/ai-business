import type { SDKAssistantMessage } from "@cursor/sdk";

/** Match `dispatch.ts` cap for task logs / runner payloads. */
export const RUNNER_ASSISTANT_OUTPUT_MAX_CHARS = 60_000;

/** Smaller excerpt stored on orchestration payloads (observability without huge JSON). */
export const RUNNER_ASSISTANT_OUTPUT_PAYLOAD_MAX_CHARS = 12_000;

/**
 * Appends text blocks from a streamed `assistant` SDK message (same shape as `dispatch.ts`).
 */
export function appendAssistantTextFromAssistantMessage(
  text: string,
  assistant: SDKAssistantMessage,
): string {
  const parts = assistant.message?.content;
  if (!Array.isArray(parts)) return text;
  let out = text;
  for (const block of parts) {
    if (
      typeof block === "object" &&
      block !== null &&
      "type" in block &&
      block.type === "text" &&
      "text" in block &&
      typeof (block as { text: unknown }).text === "string"
    ) {
      out += (block as { text: string }).text;
    }
  }
  return out;
}

export function truncateAssistantTextForPayload(
  text: string,
  maxChars: number = RUNNER_ASSISTANT_OUTPUT_PAYLOAD_MAX_CHARS,
): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n…(truncated)`;
}
