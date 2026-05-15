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

  /* ── Full layout: paperclip + textarea + send ── */
  return (
    <div className="mt-3 rounded-2xl border border-border/60 bg-background/35 p-3 shadow-[0_-20px_50px_-40px_rgba(168,235,18,0.65)] backdrop-blur-md supports-[backdrop-filter]:bg-background/25">
      <div className="flex items-end gap-2">
        <button
          type="button"
          aria-label="Attachments (soon)"
          title="Attachments are coming soon"
          disabled
          className="inline-flex size-11 shrink-0 cursor-not-allowed items-center justify-center rounded-xl border border-border/50 bg-muted/20 text-muted-foreground opacity-55 transition-colors hover:bg-muted/35"
        >
          <Paperclip className="size-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <textarea
            ref={taRef}
            value={value}
            disabled={disabled}
            maxLength={maxLen}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Message…"
            className={cn(
              "w-full resize-none rounded-xl border px-4 py-3 text-sm leading-5 outline-none transition-[border-color,box-shadow]",
              "border-border/70 bg-muted/25 text-foreground placeholder:text-muted-foreground",
              "min-h-[44px]",
              disabled && "cursor-not-allowed opacity-55",
              "focus-visible:border-primary/55 focus-visible:ring-2 focus-visible:ring-ring",
            )}
          />
          <div className={cn("flex items-center justify-end px-1", !showCounter && "opacity-0")}>
            <span className={cn(
              "text-[11px] tabular-nums",
              value.length >= maxLen ? "text-destructive" : "text-muted-foreground",
            )}>
              {value.length}/{maxLen}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={sendNow}
          disabled={disabled || !trimmed}
          aria-label="Send message"
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition-all",
            "bg-primary text-primary-foreground hover:bg-primary/92",
            "shadow-[0_10px_30px_-22px_rgba(168,235,18,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-35",
          )}
        >
          <ArrowUp className="size-4" />
        </button>
      </div>
      <p className="mt-2 px-1 text-[11px] text-muted-foreground">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
