"use client";

import { useEffect, useMemo, useState } from "react";

import { useChatStream, type ChatMessage } from "@/hooks/use-chat-stream";
import { CHAT_CONFIGS } from "@/lib/chat/chat-config";
import { cn } from "@/lib/utils";

import { ArtifactPanel } from "./artifact-panel";
import { ChatShell } from "./chat-shell";

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

  return (
    <div className="flex h-full min-h-0 w-full p-4 sm:p-5">
      <div className="flex min-h-0 w-full flex-row overflow-hidden rounded-2xl border border-white/[0.07] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_48px_-12px_rgba(0,0,0,0.5)]">
        <section
          className={cn(
            "relative flex min-h-0 flex-col overflow-hidden bg-[#0d0d0f]",
            "bg-[radial-gradient(800px_400px_at_30%_0%,rgba(168,235,18,0.05),transparent_60%)]",
            "transition-[flex-basis] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
            artifactOpen ? "basis-[28%] min-w-[220px]" : "basis-full",
          )}
        >
          <ChatShell
            features={CHAT_CONFIGS.agentChat}
            messages={messages}
            isLoading={isLoading}
            agentLabel={agentName}
            businessId={businessId}
            onSend={(text) => void send(sessionId, businessId, text)}
            disabled={isLoading}
            onViewArtifactMessage={(id) => setArtifactMessageId(id)}
            onQuestionAnswer={(questionId, answer) =>
              void send(sessionId, businessId, `[answer:${questionId}] ${answer}`)
            }
            header={
              <div className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.05] px-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative shrink-0">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-white/[0.06] text-[13px] font-semibold text-foreground/70 ring-1 ring-white/[0.08]">
                      {agentName.trim().charAt(0).toUpperCase()}
                    </span>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#0d0d0f]",
                        isLoading ? "animate-pulse bg-primary" : "bg-emerald-500",
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold leading-none tracking-tight text-foreground">
                      {agentName}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-none text-muted-foreground/40">
                      {isLoading ? "streaming…" : slugLabel}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "hidden rounded-full px-2.5 py-1 text-[10px] font-medium tracking-wide sm:block",
                    isLoading
                      ? "bg-primary/10 text-primary/80"
                      : "bg-white/[0.04] text-muted-foreground/40",
                  )}
                >
                  {isLoading ? "Streaming" : "Ready"}
                </span>
              </div>
            }
            className="min-h-0 flex-1"
            inputClassName="border-t-0"
          />
        </section>

        <div
          className={cn(
            "min-h-0 overflow-hidden border-l border-white/[0.05] bg-[#0b0b0d]",
            "transition-[flex-basis,opacity] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
            artifactOpen ? "basis-[72%] min-w-0 opacity-100" : "basis-0 opacity-0",
          )}
        >
          <ArtifactPanel artifact={activeArtifact} onClose={() => setArtifactMessageId(null)} />
        </div>
      </div>
    </div>
  );
}
