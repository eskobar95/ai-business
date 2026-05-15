"use client";

import { AlertCircle, ArrowRight, Bot } from "lucide-react";

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

function isErrorContent(content: string) {
  return content.startsWith("Connection error") || content.startsWith("Error:");
}

/** Three-dot typing indicator */
function TypingDots() {
  return (
    <div className="flex items-center gap-[3px] px-1 py-0.5" aria-label="Thinking…">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-current opacity-40"
          style={{ animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </div>
  );
}

export function ChatBubble({
  message,
  agentLabel = "Assistant",
  onViewArtifact,
  onQuestionAnswer,
  isFirstInGroup,
  isLastInGroup,
}: {
  message: ChatMessage;
  agentLabel?: string;
  onViewArtifact?: () => void;
  onQuestionAnswer?: (id: string, answer: string) => void;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}) {
  const isUser = message.role === "user";
  const isTyping = !isUser && message.isStreaming && !message.content && !message.thinking && !message.stage;

  /* ── User bubble ── */
  if (isUser) {
    return (
      <div className={cn("flex justify-end", isLastInGroup ? "mb-3" : "mb-0.5")}>
        <div
          className={cn(
            "max-w-[78%] min-w-0 px-3 py-2 text-sm leading-relaxed text-foreground",
            "rounded-2xl rounded-br-[6px]",
            isLastInGroup === false && "rounded-br-2xl",
          )}
          style={{
            background: "linear-gradient(145deg, rgba(168,235,18,0.14) 0%, rgba(168,235,18,0.07) 100%)",
            border: "1px solid rgba(168,235,18,0.18)",
          }}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          <time className="mt-0.5 block text-right text-[10px] tabular-nums text-muted-foreground/50" dateTime={message.createdAt.toISOString()}>
            {formatMessageTime(message.createdAt)}
          </time>
        </div>
      </div>
    );
  }

  /* ── Assistant bubble ── */
  const hasArtifact = message.artifact && (Boolean(message.artifact.title) || Boolean(message.artifact.content));
  const isError = isErrorContent(message.content);

  return (
    <div className={cn("flex items-start gap-2", isLastInGroup ? "mb-3" : "mb-0.5")}>
      {/* Small avatar — only show on first message in a group */}
      <div className="mt-0.5 shrink-0 w-6 flex justify-center">
        {isFirstInGroup !== false && (
          <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
            <Bot className="size-3 text-primary/70" aria-hidden />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {/* Agent label — only on first in group */}
        {isFirstInGroup !== false && (
          <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">
            {agentLabel}
          </p>
        )}

        <div className={cn(
          "rounded-2xl rounded-tl-[6px] px-3 py-2.5 text-sm leading-relaxed",
          isFirstInGroup !== false && "rounded-tl-2xl",
          isError
            ? "bg-destructive/8 border border-destructive/20 text-destructive/90"
            : "bg-white/[0.04] border border-white/[0.06] text-foreground/90",
        )}>
          {/* Typing indicator */}
          {isTyping && (
            <div className="text-muted-foreground/50">
              <TypingDots />
            </div>
          )}

          {/* Thinking block */}
          {message.thinking !== undefined && (
            <ThinkingBlock
              thinking={message.thinking}
              thinkingDone={message.thinkingDone}
              isStreaming={message.isStreaming}
            />
          )}

          {/* Stage indicator */}
          {message.isStreaming && message.stage && (
            <StageIndicator stage={message.stage} active />
          )}

          {/* Error icon */}
          {isError && (
            <div className="mb-1.5 flex items-center gap-1.5">
              <AlertCircle className="size-3.5 shrink-0 opacity-70" />
              <span className="text-[11px] font-medium uppercase tracking-wide opacity-60">Error</span>
            </div>
          )}

          {/* Content */}
          {message.content && !isTyping && (
            <ChatMarkdown text={message.content} className="text-[13px] leading-relaxed [&>p]:mb-1.5 [&>p:last-child]:mb-0" />
          )}

          {/* Streaming cursor */}
          {message.isStreaming && message.content && (
            <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-primary/60 align-middle" aria-hidden />
          )}

          {/* Artifact link */}
          {hasArtifact && (
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/8 px-2 py-1 text-[11px] font-medium text-primary/80 transition-colors hover:bg-primary/14"
              onClick={onViewArtifact}
            >
              View artifact
              <ArrowRight className="size-3" aria-hidden />
            </button>
          )}

          {/* Questions */}
          {message.questions && message.questions.length > 0 && onQuestionAnswer && (
            <QuestionCard questions={message.questions} onAnswer={onQuestionAnswer} />
          )}
        </div>

        {isLastInGroup && (
          <time className="mt-0.5 block pl-1 text-[10px] tabular-nums text-muted-foreground/30" dateTime={message.createdAt.toISOString()}>
            {formatMessageTime(message.createdAt)}
          </time>
        )}
      </div>
    </div>
  );
}
