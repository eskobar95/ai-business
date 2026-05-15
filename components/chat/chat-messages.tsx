"use client";

import { MessageSquare } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { ChatMessage } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/utils";

import { ChatBubble } from "./chat-bubble";

function chunkByRole(messages: ChatMessage[]) {
  const groups: ChatMessage[][] = [];
  for (const m of messages) {
    const last = groups[groups.length - 1];
    if (!last || last[0]?.role !== m.role) groups.push([m]);
    else last.push(m);
  }
  return groups;
}

function SkeletonBubble({ align }: { align: "left" | "right" }) {
  return (
    <div className={cn("flex w-full", align === "right" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "animate-pulse rounded-2xl border border-border/50 bg-muted/25",
          align === "right" ? "h-14 w-[min(72%,360px)]" : "h-24 w-[min(82%,560px)]",
        )}
      />
    </div>
  );
}

export function ChatMessages({
  messages,
  isLoading,
  agentLabel = "Assistant",
  onViewArtifactMessage,
  onQuestionAnswer,
  isBootstrapping,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  agentLabel?: string;
  onViewArtifactMessage?: (messageId: string) => void;
  onQuestionAnswer?: (id: string, answer: string) => void;
  isBootstrapping?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);

  const grouped = useMemo(() => chunkByRole(messages), [messages]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const slack = 64;
    const atBottom =
      el.scrollHeight - el.clientHeight <= el.scrollTop + slack + 2;
    pinnedToBottomRef.current = atBottom;
  }, []);

  useEffect(() => {
    if (!pinnedToBottomRef.current) return;
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const showSkeleton =
    Boolean(isBootstrapping) || (Boolean(isLoading) && messages.length === 0);

  const showEmpty = messages.length === 0 && !showSkeleton && !isLoading;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6"
      role="log"
      aria-label="Conversation"
    >
      {showSkeleton ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <SkeletonBubble align="right" />
          <SkeletonBubble align="left" />
        </div>
      ) : null}

      {showEmpty ? (
        <div className="mx-auto mt-28 flex max-w-md flex-col items-center text-center">
          <div className="border-border/60 bg-muted/15 text-muted-foreground mb-4 flex size-14 items-center justify-center rounded-full border">
            <MessageSquare className="size-7" aria-hidden />
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            Start the conversation
          </p>
          <p className="text-muted-foreground/80 mt-2 text-xs leading-relaxed">
            Ask anything about your business—this thread keeps decisions, artifacts, and
            follow-ups tidy.
          </p>
        </div>
      ) : null}

      {!showSkeleton && !showEmpty ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-10">
          {grouped.map((group) => (
            <div key={`${group[0]?.role}:${group[0]?.id ?? "grp"}`} className="flex flex-col gap-1">
              {group.map((m, idx) => (
                <ChatBubble
                  key={m.id}
                  message={m}
                  agentLabel={agentLabel}
                  isLastInGroup={idx === group.length - 1}
                  onViewArtifact={
                    m.role === "assistant" &&
                    Boolean(m.artifact) &&
                    onViewArtifactMessage
                      ? () => onViewArtifactMessage(m.id)
                      : undefined
                  }
                  onQuestionAnswer={
                    m.role === "assistant" &&
                    Boolean(m.questions?.length) &&
                    onQuestionAnswer
                      ? onQuestionAnswer
                      : undefined
                  }
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
