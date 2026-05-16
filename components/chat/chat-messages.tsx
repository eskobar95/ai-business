"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageSquare } from "lucide-react";
import { useMemo } from "react";

import type { ChatFeatures } from "@/lib/chat/chat-config";
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
  features,
  businessId,
  onViewArtifactMessage,
  onQuestionAnswer,
  onToolApproval,
  isBootstrapping,
  className,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  agentLabel?: string;
  features?: ChatFeatures;
  businessId?: string;
  onViewArtifactMessage?: (messageId: string) => void;
  onQuestionAnswer?: (id: string, answer: string) => void;
  onToolApproval?: (toolId: string, approvalId: string, approved: boolean) => void;
  isBootstrapping?: boolean;
  className?: string;
}) {
  const grouped = useMemo(() => chunkByRole(messages), [messages]);

  const showSkeleton =
    Boolean(isBootstrapping) || (Boolean(isLoading) && messages.length === 0);

  const showEmpty = messages.length === 0 && !showSkeleton && !isLoading;

  return (
    <Conversation className={cn("min-h-0 flex-1", className)}>
      <ConversationContent className="mx-auto w-full max-w-3xl gap-1 px-4 py-4 sm:px-6 sm:py-6">
        {showSkeleton ? (
          <div className="flex flex-col gap-4">
            <SkeletonBubble align="right" />
            <SkeletonBubble align="left" />
          </div>
        ) : null}

        {showEmpty ? (
          <div className="mx-auto mt-28 flex max-w-md flex-col items-center text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-muted-foreground">
              <MessageSquare className="size-7" aria-hidden />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Start the conversation</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
              Ask anything about your business—this thread keeps decisions, artifacts, and
              follow-ups tidy.
            </p>
          </div>
        ) : null}

        {!showSkeleton && !showEmpty
          ? grouped.map((group) => (
              <div
                key={`${group[0]?.role}:${group[0]?.id ?? "grp"}`}
                className="flex flex-col gap-0.5 pb-2"
              >
                {group.map((m, idx) => (
                  <ChatBubble
                    key={m.id}
                    message={m}
                    agentLabel={agentLabel}
                    features={features}
                    businessId={businessId}
                    isFirstInGroup={idx === 0}
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
                    onToolApproval={onToolApproval}
                  />
                ))}
              </div>
            ))
          : null}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
