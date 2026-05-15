"use client";

import { ArrowRight, Bot } from "lucide-react";

import type { ChatMessage } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/utils";

import { ChatMarkdown } from "./chat-markdown";
import { QuestionCard } from "./question-card";
import { StageIndicator } from "./stage-indicator";
import { ThinkingBlock } from "./thinking-block";

function formatMessageTime(d: Date) {
  try {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ChatBubble({
  message,
  agentLabel = "Assistant",
  onViewArtifact,
  onQuestionAnswer,
  isLastInGroup,
}: {
  message: ChatMessage;
  /** Shown on assistant rows. */
  agentLabel?: string;
  onViewArtifact?: () => void;
  onQuestionAnswer?: (id: string, answer: string) => void;
  /** Visual emphasis on the last bubble in a same-role group. */
  isLastInGroup?: boolean;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div
        className={cn(
          "flex w-full justify-end",
          isLastInGroup === false ? "mb-1" : "mb-0",
        )}
      >
        <div className="max-w-[72%] min-w-0">
          <div
            className="bg-primary/12 text-foreground border border-primary/25 relative rounded-[22px] px-4 py-2.5 shadow-[0_0_0_1px_rgba(168,235,18,0.08)]"
            style={{
              background:
                "linear-gradient(135deg, rgba(168,235,18,0.12) 0%, rgba(168,235,18,0.05) 100%)",
            }}
          >
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
            <time
              className="text-muted-foreground mt-1 block text-right text-[10px] tabular-nums"
              dateTime={message.createdAt.toISOString()}
            >
              {formatMessageTime(message.createdAt)}
            </time>
          </div>
        </div>
      </div>
    );
  }

  const hasArtifact =
    message.artifact &&
    (Boolean(message.artifact.title) || Boolean(message.artifact.content));

  return (
    <div
      className={cn(
        "flex w-full justify-start",
        isLastInGroup === false ? "mb-1" : "mb-0",
      )}
    >
      <div className="max-w-[min(92%,880px)] min-w-0">
        <div className="bg-muted/12 border-border/60 flex gap-3 rounded-2xl border px-3 py-3 sm:px-4 sm:py-3.5">
          <div className="mt-0.5 hidden shrink-0 sm:block">
            <span className="bg-muted text-muted-foreground border-border flex size-9 items-center justify-center rounded-full border">
              <Bot className="size-4" aria-hidden />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-foreground text-sm font-semibold tracking-tight">
                {agentLabel}
              </span>
              <span className="text-muted-foreground sm:hidden">
                <Bot className="size-3.5" aria-hidden />
              </span>
            </div>

            {message.thinking !== undefined ? (
              <ThinkingBlock
                thinking={message.thinking}
                thinkingDone={message.thinkingDone}
                isStreaming={message.isStreaming}
              />
            ) : null}

            {message.isStreaming && message.stage ? (
              <StageIndicator stage={message.stage} active />
            ) : null}

            <ChatMarkdown text={message.content} className="text-sm" />

            {message.isStreaming ? (
              <span className="text-primary ml-0.5 inline-block animate-pulse" aria-hidden>
                |
              </span>
            ) : null}

            {hasArtifact ? (
              <div className="mt-3">
                <button
                  type="button"
                  className="text-primary hover:text-primary/85 focus-visible:ring-ring group inline-flex items-center gap-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  onClick={onViewArtifact}
                >
                  View artifact
                  <ArrowRight className="group-hover:translate-x-px size-4 transition-transform" aria-hidden />
                </button>
              </div>
            ) : null}

            {message.questions &&
            message.questions.length > 0 &&
            onQuestionAnswer ? (
              <QuestionCard
                questions={message.questions}
                onAnswer={onQuestionAnswer}
              />
            ) : null}

            <time
              className="text-muted-foreground mt-3 block text-right text-[10px] tabular-nums"
              dateTime={message.createdAt.toISOString()}
            >
              {formatMessageTime(message.createdAt)}
            </time>
          </div>
        </div>
      </div>
    </div>
  );
}
