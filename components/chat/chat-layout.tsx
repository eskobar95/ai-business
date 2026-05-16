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
    <div className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      {/* ── Chat pane ── */}
      <section
        className={cn(
          "relative flex min-h-0 flex-col overflow-hidden",
          "bg-[radial-gradient(900px_500px_at_20%_0%,rgba(168,235,18,0.06),transparent_55%)]",
          "transition-[flex-basis] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
          artifactOpen ? "basis-[25%] min-w-[240px]" : "basis-full",
        )}
      >
        {/* Agent header */}
        <div className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
          <div className="flex min-w-0 items-center gap-3">
            <AgentAvatar name={agentName} status={statusDot} size="sm" />
            <div className="min-w-0 flex items-baseline gap-2">
              <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                {agentName}
              </p>
              <span className="text-[11px] text-muted-foreground/40 tabular-nums">
                {isLoading ? "streaming…" : artifactOpen ? "split view" : slugLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable messages — fills all remaining space */}
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          agentLabel={agentName}
          onViewArtifactMessage={(id) => setArtifactMessageId(id)}
          onQuestionAnswer={(questionId, answer) =>
            void send(sessionId, businessId, `[answer:${questionId}] ${answer}`)
          }
        />

        {/* Fixed input at the bottom */}
        <div className="shrink-0 border-t border-white/[0.06] bg-background/5 px-4 pb-5 pt-3 sm:px-6 backdrop-blur-sm">
          <ChatInput
            onSend={(text) => void send(sessionId, businessId, text)}
            disabled={isLoading}
          />
        </div>
      </section>

      {/* ── Artifact pane ── */}
      <div
        className={cn(
          "min-h-0 overflow-hidden border-l border-white/[0.06] bg-[#0c0c0e] backdrop-blur-md",
          "transition-[flex-basis,opacity] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
          artifactOpen ? "basis-[75%] min-w-0 opacity-100" : "basis-0 opacity-0",
        )}
      >
        <ArtifactPanel artifact={activeArtifact} onClose={() => setArtifactMessageId(null)} />
      </div>
    </div>
  );
}
