"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import type { ChatMessage } from "@/hooks/use-chat-stream";

import { ChatMarkdown } from "./chat-markdown";

export function ArtifactPanel({
  artifact,
  onClose,
}: {
  artifact: ChatMessage["artifact"] | null | undefined;
  onClose: () => void;
}) {
  const open = Boolean(artifact);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <aside
      ref={asideRef}
      className={cn(
        "border-border bg-card/92 flex min-h-0 flex-col backdrop-blur-md transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none",
        open
          ? "translate-x-0 opacity-100"
          : "pointer-events-none translate-x-3 opacity-0",
      )}
      aria-hidden={!open}
    >
      {artifact ? (
        <>
          <header className="border-border bg-background/40 flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-foreground truncate text-lg font-semibold tracking-tight">
                {artifact.title}
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                {artifact.type === "document" ? "Document" : "React component"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="bg-primary/18 text-primary rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide uppercase ring-1 ring-primary/30">
                {artifact.type === "document" ? "Markdown" : "React"}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
                aria-label="Close artifact panel"
                onClick={onClose}
              >
                <X className="size-4" />
              </button>
            </div>
          </header>
          <div className="relative min-h-0 flex-1 overflow-y-auto p-5">
            {artifact.type === "document" ? (
              <ChatMarkdown text={artifact.content} />
            ) : (
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  Preview is not executed in the browser. Source is shown below.
                </p>
                <div className="border-border/60 bg-muted/35 relative overflow-hidden rounded-xl border">
                  <span className="text-muted-foreground absolute top-2 right-3 font-mono text-[10px] uppercase">
                    tsx
                  </span>
                  <pre className="max-h-[min(70vh,720px)] overflow-auto p-4 pt-8 font-mono text-[0.8125rem] leading-relaxed text-foreground">
                    <code>{artifact.content}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </aside>
  );
}
