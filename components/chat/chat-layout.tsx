"use client";

import { useEffect, useMemo, useState } from "react";

import { AgentAvatar } from "@/components/ui/agent-avatar";
import { useChatStream, type ChatMessage } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/utils";

import { ArtifactPanel } from "./artifact-panel";
import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";

function normalizeIncomingMessages(messages: ChatMessage[]) {
  return messages.map((m) => ({
    ...m,
    createdAt:
      m.createdAt instanceof Date
        ? m.createdAt
        : new Date(m.createdAt as unknown as string),
  }));
}

export function ChatLayout({
  sessionId,
  businessId,
  agentName,
  agentSlug,
  initialMessages,
}: {
  sessionId: string;
  businessId: string;
  agentName: string;
  agentSlug?: string;
  initialMessages: ChatMessage[];
}) {
  const { messages, isLoading, send, initMessages } = useChatStream();
  const [artifactMessageId, setArtifactMessageId] = useState<string | null>(null);

  useEffect(() => {
    initMessages(normalizeIncomingMessages(initialMessages));
  }, [initialMessages, initMessages]);

  const slugLabel = agentSlug ?? agentName.toLowerCase().replaceAll(/\s+/g, "-");

  const activeArtifact = useMemo(() => {
    if (!artifactMessageId) return null;
    return messages.find((m) => m.id === artifactMessageId)?.artifact ?? null;
  }, [artifactMessageId, messages]);

  const artifactOpen = Boolean(activeArtifact);

  const statusDot: "active" | "idle" = isLoading ? "active" : "idle";

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden rounded-3xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
        <section
          className={cn(
            "relative flex min-h-0 flex-col bg-[radial-gradient(1200px_600px_at_20%_0%,rgba(168,235,18,0.12),transparent_55%)] transition-[flex-basis,flex-grow,width] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
            artifactOpen ? "basis-[25%] min-w-[260px]" : "basis-full",
          )}
        >
          <div className="border-border/55 relative z-[1] border-b backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <AgentAvatar name={agentName} status={statusDot} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-foreground truncate text-sm font-semibold tracking-tight">
                      {agentName}
                    </p>
                    <span className="text-muted-foreground text-xs">
                      · {artifactOpen ? "split view" : "chat"}
                    </span>
                  </div>
                  <p className="text-muted-foreground truncate text-[11px]">{slugLabel}</p>
                </div>
              </div>
              <span className="text-muted-foreground hidden text-[11px] sm:block">
                {isLoading ? "Streaming" : "Ready"}
              </span>
            </div>
          </div>

          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            agentLabel={agentName}
            onViewArtifactMessage={(id) => setArtifactMessageId(id)}
            onQuestionAnswer={(questionId, answer) =>
              void send(
                sessionId,
                businessId,
                `[answer:${questionId}] ${answer}`,
              )
            }
          />

          <div className="border-border/50 bg-background/10 px-5 pb-4 pt-3 backdrop-blur-sm sm:px-6">
            <ChatInput
              onSend={(text) => void send(sessionId, businessId, text)}
              disabled={isLoading}
            />
          </div>
        </section>

        <div
          className={cn(
            "min-h-0 bg-card/98 shadow-[inset_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-[flex-basis,width,opacity] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
            artifactOpen ? "basis-[75%] min-w-0 opacity-100" : "basis-0 overflow-hidden opacity-0",
          )}
        >
          <ArtifactPanel artifact={activeArtifact} onClose={() => setArtifactMessageId(null)} />
        </div>
      </div>
    </div>
  );
}
