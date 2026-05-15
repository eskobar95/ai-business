"use client";

import { ArrowUp, Paperclip } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const maxLen = 4000;

  const resize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    const max = Math.round(Number.parseFloat(getComputedStyle(el).lineHeight || "20") * 6);
    const target = Math.min(el.scrollHeight, max || 160);
    el.style.height = `${Math.max(target, 44)}px`;
    el.style.overflowY = el.scrollHeight > target ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resize();
  }, [resize, value]);

  const trimmed = value.trim();
  const atLimitRatio = value.length / maxLen;
  const showCounter = atLimitRatio >= 0.8;

  const sendNow = () => {
    const text = trimmed;
    if (!text || disabled) return;
    onSend(text.slice(0, maxLen));
    setValue("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      sendNow();
    }
  };

  return (
    <div className="border-border/60 bg-background/35 supports-[backdrop-filter]:bg-background/25 mt-3 rounded-2xl border p-3 shadow-[0_-20px_50px_-40px_rgba(168,235,18,0.65)] backdrop-blur-md">
      <div className="flex items-end gap-2">
        <button
          type="button"
          aria-label="Attachments (soon)"
          title="Attachments are coming soon"
          disabled
          className={cn(
            "text-muted-foreground border-border/50 bg-muted/20 hover:bg-muted/35 inline-flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors",
            "cursor-not-allowed opacity-55",
          )}
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
            placeholder="Message..."
            className={cn(
              "placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-none rounded-xl border px-4 py-3 text-sm leading-5 outline-none transition-[border-color,box-shadow]",
              "border-border/70 bg-muted/25 text-foreground",
              "min-h-[44px]",
              disabled && "cursor-not-allowed opacity-55",
              "focus-visible:border-primary/55 focus-visible:ring-2",
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
            "focus-visible:ring-ring shadow-[0_10px_30px_-22px_rgba(168,235,18,0.85)] focus-visible:ring-2 focus-visible:outline-none",
            "disabled:pointer-events-none disabled:opacity-35",
          )}
        >
          <ArrowUp className="size-4" />
        </button>
      </div>
      <p className="text-muted-foreground mt-2 px-1 text-[11px]">
        Tip: Send with ⌘Enter or Ctrl+Enter
      </p>
    </div>
  );
}
