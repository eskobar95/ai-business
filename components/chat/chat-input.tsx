"use client";

import { ArrowUp, Paperclip } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function ChatInput({
  onSend,
  disabled,
  compact,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  /** Compact mode: send button lives inside the textarea container */
  compact?: boolean;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const maxLen = 4000;

  const resize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    const lineH = Number.parseFloat(getComputedStyle(el).lineHeight || "20");
    const maxLines = compact ? 5 : 6;
    const cap = Math.round(lineH * maxLines) || (compact ? 120 : 160);
    const target = Math.min(el.scrollHeight, cap);
    el.style.height = `${Math.max(target, compact ? 40 : 44)}px`;
    el.style.overflowY = el.scrollHeight > cap ? "auto" : "hidden";
  }, [compact]);

  useEffect(() => { resize(); }, [resize, value]);

  const trimmed = value.trim();
  const showCounter = value.length / maxLen >= 0.8;

  const sendNow = useCallback(() => {
    const text = trimmed;
    if (!text || disabled) return;
    onSend(text.slice(0, maxLen));
    setValue("");
    setTimeout(() => resize(), 0);
  }, [trimmed, disabled, onSend, resize]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendNow();
    }
  };

  /* ── Compact: unified container with embedded send button ── */
  if (compact) {
    return (
      <div
        className={cn(
          "relative rounded-2xl border transition-all duration-150",
          "bg-white/[0.04]",
          focused
            ? "border-primary/40 shadow-[0_0_0_3px_rgba(168,235,18,0.08)]"
            : "border-white/[0.08]",
          disabled && "opacity-50",
        )}
      >
        <textarea
          ref={taRef}
          value={value}
          disabled={disabled}
          maxLength={maxLen}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={1}
          placeholder="Message…"
          className={cn(
            "w-full resize-none bg-transparent text-sm leading-5 text-foreground outline-none",
            "placeholder:text-muted-foreground/40",
            "min-h-[40px] py-2.5 pl-3.5 pr-12",
            disabled && "cursor-not-allowed",
          )}
        />

        {/* Embedded send button */}
        <button
          type="button"
          onClick={sendNow}
          disabled={disabled || !trimmed}
          aria-label="Send message"
          className={cn(
            "absolute bottom-1.5 right-1.5 flex size-7 items-center justify-center rounded-[10px] transition-all duration-150",
            trimmed && !disabled
              ? "bg-primary text-primary-foreground shadow-[0_4px_12px_-2px_rgba(168,235,18,0.4)] hover:bg-primary/90 active:scale-95"
              : "bg-white/[0.06] text-muted-foreground/30",
            "disabled:pointer-events-none",
          )}
        >
          <ArrowUp className="size-3.5" />
        </button>

        {/* Char counter */}
        {showCounter && (
          <span className={cn(
            "absolute bottom-2.5 right-10 text-[10px] tabular-nums",
            value.length >= maxLen ? "text-destructive" : "text-muted-foreground/50",
          )}>
            {value.length}/{maxLen}
          </span>
        )}

        {/* Subtle hint */}
        <p className="absolute -bottom-5 left-0.5 text-[10px] text-muted-foreground/30 select-none">
          Shift+Enter for new line
        </p>
      </div>
    );
  }

  /* ── Full layout: unified container with embedded actions ── */
  return (
    <div
      className={cn(
        "relative rounded-2xl border transition-all duration-150",
        "bg-white/[0.03]",
        focused
          ? "border-primary/35 shadow-[0_0_0_3px_rgba(168,235,18,0.07)]"
          : "border-white/[0.08]",
        disabled && "opacity-50",
      )}
    >
      {/* Textarea */}
      <textarea
        ref={taRef}
        value={value}
        disabled={disabled}
        maxLength={maxLen}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={1}
        placeholder="Message…"
        className={cn(
          "w-full resize-none bg-transparent text-[13px] leading-5 text-foreground outline-none",
          "placeholder:text-muted-foreground/35",
          "min-h-[48px] px-4 pb-10 pt-3.5",
          disabled && "cursor-not-allowed",
        )}
      />

      {/* Bottom toolbar */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 pb-2.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled
            title="Attachments coming soon"
            aria-label="Attachments"
            className="flex size-7 cursor-not-allowed items-center justify-center rounded-lg text-muted-foreground/25 transition-colors hover:bg-white/[0.04] hover:text-muted-foreground/40"
          >
            <Paperclip className="size-3.5" />
          </button>
          <span className="text-[10px] text-muted-foreground/25 select-none">
            Shift+Enter for new line
          </span>
        </div>

        <div className="flex items-center gap-2">
          {showCounter && (
            <span className={cn(
              "text-[10px] tabular-nums",
              value.length >= maxLen ? "text-destructive" : "text-muted-foreground/40",
            )}>
              {value.length}/{maxLen}
            </span>
          )}
          <button
            type="button"
            onClick={sendNow}
            disabled={disabled || !trimmed}
            aria-label="Send message"
            className={cn(
              "flex size-8 items-center justify-center rounded-xl transition-all duration-150",
              trimmed && !disabled
                ? "bg-primary text-primary-foreground shadow-[0_4px_16px_-4px_rgba(168,235,18,0.5)] hover:bg-primary/90 active:scale-95"
                : "bg-white/[0.05] text-muted-foreground/25",
              "disabled:pointer-events-none",
            )}
          >
            <ArrowUp className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
