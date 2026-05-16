"use client";

import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import type { ChatStatus } from "ai";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

export function ChatInput({
  onSend,
  disabled,
  compact,
  onStop,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  /** Compact mode for widget */
  compact?: boolean;
  onStop?: () => void;
}) {
  const [value, setValue] = useState("");

  const status: ChatStatus = disabled ? "streaming" : "ready";

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = message.text.trim();
      if (!text || disabled) return;
      onSend(text);
      setValue("");
    },
    [disabled, onSend],
  );

  return (
    <PromptInput
      onSubmit={handleSubmit}
      className={cn(
        "relative rounded-2xl border transition-all duration-150",
        "bg-white/[0.04] border-white/[0.08]",
        "has-[[data-slot=input-group-control]:focus-visible]:border-primary/40",
        "has-[[data-slot=input-group-control]:focus-visible]:shadow-[0_0_0_3px_rgba(168,235,18,0.08)]",
        disabled && "opacity-50",
        compact ? "text-sm" : undefined,
      )}
    >
      <PromptInputTextarea
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Message…"
        className={cn(
          "min-h-[44px] resize-none bg-transparent text-foreground outline-none",
          "placeholder:text-muted-foreground/40",
          compact ? "min-h-[40px] py-2.5 pl-3.5 pr-12 text-sm" : "min-h-[48px] px-4 pb-10 pt-3.5 text-[13px]",
        )}
      />
      <PromptInputFooter
        className={cn(
          compact
            ? "absolute inset-x-0 bottom-0 justify-end p-1.5"
            : "justify-between px-3 pb-2.5",
        )}
      >
        {!compact && (
          <span className="text-[10px] text-muted-foreground/30 select-none">
            Shift+Enter for new line
          </span>
        )}
        <PromptInputSubmit
          status={status}
          onStop={onStop}
          disabled={!value.trim() && !disabled}
          className={cn(
            compact && "absolute bottom-1.5 right-1.5",
            value.trim() && !disabled
              ? "bg-primary text-primary-foreground shadow-[0_4px_12px_-2px_rgba(168,235,18,0.4)]"
              : "bg-white/[0.06] text-muted-foreground/30",
          )}
        />
      </PromptInputFooter>
      {compact && (
        <p className="pointer-events-none absolute -bottom-5 left-0.5 text-[10px] text-muted-foreground/30 select-none">
          Shift+Enter for new line
        </p>
      )}
    </PromptInput>
  );
}
