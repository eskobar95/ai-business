"use client";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";

export function ThinkingBlock({
  thinking,
  thinkingDone,
  isStreaming,
  durationSec,
}: {
  thinking: string | undefined;
  thinkingDone?: boolean;
  isStreaming?: boolean;
  durationSec?: number;
}) {
  if (thinking === undefined) return null;

  const isActive = !thinkingDone && Boolean(isStreaming);
  const hasContent = Boolean(thinking.trim());

  // Avoid a second "Thinking…" shimmer when the model has no reasoning body yet.
  if (!hasContent) return null;

  return (
    <Reasoning
      className="mb-2 w-full"
      isStreaming={isActive}
      duration={durationSec}
      defaultOpen={isActive}
    >
      <ReasoningTrigger />
      {hasContent && <ReasoningContent>{thinking}</ReasoningContent>}
    </Reasoning>
  );
}
