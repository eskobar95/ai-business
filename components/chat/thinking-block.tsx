"use client";

import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function ThinkingBlock({
  thinking,
  thinkingDone,
  isStreaming,
}: {
  thinking: string | undefined;
  thinkingDone?: boolean;
  isStreaming?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (isStreaming && thinkingDone !== true) setExpanded(true);
  }, [isStreaming, thinkingDone]);

  useEffect(() => {
    if (thinkingDone && !isStreaming) setExpanded(false);
  }, [thinkingDone, isStreaming]);

  if (thinking === undefined) return null;

  const hasText = Boolean(thinking.trim());

  return (
    <div className="border-border/70 bg-muted/15 mb-3 overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="hover:bg-muted/25 flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors"
      >
        <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
          <Sparkles className="text-primary size-3.5 shrink-0" aria-hidden />
          Reasoning
        </span>
        {expanded ? (
          <ChevronUp className="text-muted-foreground size-4 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
        )}
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "border-border/40 border-t px-3 pb-3",
              expanded ? "max-h-48 overflow-y-auto opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <p className="text-muted-foreground mt-2 text-sm italic leading-relaxed whitespace-pre-wrap">
              {hasText ? thinking : isStreaming ? "…" : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
