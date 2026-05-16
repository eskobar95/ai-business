"use client";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function StageIndicator({
  stage,
  steps,
  active,
  compact,
}: {
  stage?: string | null;
  /** Optional multi-step trail; falls back to single `stage` label */
  steps?: string[];
  active?: boolean;
  compact?: boolean;
}) {
  const isActive = active !== false;

  const labels =
    steps && steps.length > 0
      ? steps
      : stage
        ? [stage]
        : isActive
          ? ["Starting…"]
          : [];

  if (labels.length === 0) return null;

  return (
    <ChainOfThought
      className={cn(
        "chat-processing mb-2 w-full rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-2.5",
        compact && "px-2.5 py-2",
        !isActive && "opacity-85",
      )}
      defaultOpen
      open={isActive ? true : undefined}
    >
      <ChainOfThoughtHeader
        className={cn(
          "text-foreground/90 text-[13px] font-medium",
          compact && "text-xs",
        )}
      >
        {isActive ? "In progress" : "Steps"}
      </ChainOfThoughtHeader>
      <ChainOfThoughtContent className="pt-1">
        {labels.map((label, i) => {
          const isLast = i === labels.length - 1;
          const status = isActive && isLast ? "active" : "complete";
          return (
            <ChainOfThoughtStep
              key={`${label}-${i}`}
              className={cn(isLast && isActive && "text-foreground")}
              label={
                <span className="flex items-center gap-2 text-[13px]">
                  {isActive && isLast && (
                    <Loader2
                      className="size-3.5 shrink-0 animate-spin text-primary"
                      aria-hidden
                    />
                  )}
                  {label}
                </span>
              }
              status={status}
            />
          );
        })}
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}
