"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-[3px] rounded-full bg-current"
          style={{ animation: `typingBounce 1.2s ease-in-out ${i * 0.18}s infinite` }}
        />
      ))}
    </span>
  );
}

export function ThinkingBlock({
  thinking,
  thinkingDone,
  isStreaming,
}: {
  thinking: string | undefined;
  thinkingDone?: boolean;
  isStreaming?: boolean;
}) {
  const [peek, setPeek] = useState(false);
  const isActive = !thinkingDone && isStreaming;

  useEffect(() => {
    if (isActive) setPeek(false);
  }, [isActive]);

  if (thinking === undefined) return null;

  return (
    <div className="mb-2">
      {/* Inline indicator row */}
      <button
        type="button"
        onClick={() => setPeek((v) => !v)}
        className={cn(
          "group flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-all",
          "hover:bg-white/[0.04]",
          isActive ? "cursor-default" : "cursor-pointer",
        )}
      >
        <Sparkles
          className={cn(
            "size-2.5 shrink-0 transition-colors",
            isActive ? "text-primary/60 animate-pulse" : "text-muted-foreground/30 group-hover:text-muted-foreground/50",
          )}
          aria-hidden
        />
        <span className={cn(
          "text-[10px] tracking-wide transition-colors",
          isActive ? "text-muted-foreground/50 italic" : "text-muted-foreground/30 group-hover:text-muted-foreground/50",
        )}>
          {isActive ? (
            <span className="flex items-center gap-1">thinking <ThinkingDots /></span>
          ) : (
            peek ? "hide reasoning" : "show reasoning"
          )}
        </span>
      </button>

      {/* Peek content — only if done and user toggles */}
      {!isActive && peek && thinking.trim() && (
        <div className="mt-1.5 border-l-2 border-white/[0.08] pl-3">
          <p className="text-[11px] italic leading-relaxed text-muted-foreground/40 whitespace-pre-wrap line-clamp-6">
            {thinking}
          </p>
        </div>
      )}
    </div>
  );
}
