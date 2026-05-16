"use client";

import type { ReactNode } from "react";

import {
  type ChatFeatures,
  type ChatSurfaceKey,
  resolveChatFeatures,
} from "@/lib/chat/chat-config";
import type { ChatMessage } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/utils";

import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";

export function ChatShell({
  features: featuresProp,
  messages,
  isLoading,
  agentLabel = "Assistant",
  onSend,
  onStop,
  disabled,
  header,
  onViewArtifactMessage,
  onQuestionAnswer,
  onToolApproval,
  isBootstrapping,
  className,
  inputClassName,
  messagesClassName,
}: {
  /** Feature flags or preset surface key */
  features?: ChatFeatures | ChatSurfaceKey;
  messages: ChatMessage[];
  isLoading: boolean;
  agentLabel?: string;
  onSend: (text: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  /** Optional header slot (agent bar, widget title, etc.) */
  header?: ReactNode;
  onViewArtifactMessage?: (messageId: string) => void;
  onQuestionAnswer?: (id: string, answer: string) => void;
  onToolApproval?: (toolId: string, approvalId: string, approved: boolean) => void;
  isBootstrapping?: boolean;
  className?: string;
  inputClassName?: string;
  messagesClassName?: string;
}) {
  const features = resolveChatFeatures(featuresProp);

  return (
    <div
      className={cn(
        "ai-chat-shell flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      {header}

      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        agentLabel={agentLabel}
        features={features}
        onViewArtifactMessage={onViewArtifactMessage}
        onQuestionAnswer={onQuestionAnswer}
        onToolApproval={onToolApproval}
        isBootstrapping={isBootstrapping}
        className={messagesClassName}
      />

      <div
        className={cn(
          "shrink-0 border-t border-white/[0.05]",
          features.compact ? "px-3 pb-7 pt-2.5" : "px-4 pb-4 pt-3 sm:px-5",
          inputClassName,
        )}
      >
        <ChatInput
          onSend={onSend}
          disabled={disabled ?? isLoading}
          compact={features.compact}
          onStop={onStop}
        />
      </div>
    </div>
  );
}
