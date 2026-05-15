"use client";

import { Bot, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChatBubble } from "@/components/chat/chat-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { useChatStream, type ChatMessage } from "@/hooks/use-chat-stream";
import { ensureWidgetChatSession } from "@/lib/chat/actions";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "conductor_session_";

function chunkByRole(messages: ChatMessage[]): ChatMessage[][] {
  const groups: ChatMessage[][] = [];
  for (const m of messages) {
    const last = groups[groups.length - 1];
    if (!last || last[0]?.role !== m.role) groups.push([m]);
    else last.push(m);
  }
  return groups;
}

export function ConductorChatWidgetClient({
  businessId,
  conductorAgentId,
}: {
  businessId: string;
  conductorAgentId: string;
}) {
  const storageKey = `${STORAGE_PREFIX}${businessId}`;
  const [panelOpen, setPanelOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const { messages, isLoading, send, initMessages } = useChatStream();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(null);
    initMessages([]);
    setBootstrapError(null);
  }, [businessId, conductorAgentId, initMessages]);

  useEffect(() => {
    if (!panelOpen || sessionId !== null) return;

    let cancelled = false;

    async function bootstrap() {
      setBootstrapLoading(true);
      setBootstrapError(null);

      let stored: string | null = null;
      try {
        stored = localStorage.getItem(storageKey);
      } catch {
        /* ignore */
      }

      try {
        const res = await ensureWidgetChatSession(
          businessId,
          conductorAgentId,
          stored,
        );
        if (cancelled) return;
        setSessionId(res.sessionId);
        try {
          localStorage.setItem(storageKey, res.sessionId);
        } catch {
          /* ignore */
        }
        initMessages(
          res.initialMessages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt:
              m.createdAt instanceof Date
                ? m.createdAt
                : new Date(m.createdAt as unknown as string),
          })),
        );
      } catch (e) {
        if (!cancelled) {
          setBootstrapError(
            e instanceof Error ? e.message : "Could not start chat",
          );
        }
      } finally {
        if (!cancelled) setBootstrapLoading(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    panelOpen,
    sessionId,
    businessId,
    conductorAgentId,
    storageKey,
    initMessages,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, bootstrapLoading]);

  const grouped = useMemo(() => chunkByRole(messages), [messages]);

  const handleSend = useCallback(
    (text: string) => {
      if (!sessionId) return;
      void send(sessionId, businessId, text);
    },
    [businessId, send, sessionId],
  );

  const conductorActive = isLoading;

  return (
    <>
      {/* Slide-up panel (above launcher) */}
      <div
        className={cn(
          "fixed right-6 z-50 flex w-[380px] max-w-[calc(100vw-1.75rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/40 transition-all duration-300 ease-out",
          "bottom-20 max-h-[min(520px,75vh)]",
          panelOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0",
        )}
        aria-hidden={!panelOpen}
      >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/12 text-primary">
                <Bot className="size-4" aria-hidden />
              </span>
              <p className="text-sm font-semibold tracking-tight">Conductor</p>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="text-muted-foreground hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
              aria-label="Close Conductor chat"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-background/40 to-background/80">
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
              {bootstrapError ? (
                <p className="text-destructive px-1 text-center text-xs">
                  {bootstrapError}
                </p>
              ) : null}

              {bootstrapLoading && messages.length === 0 ? (
                <p className="text-muted-foreground px-1 text-center text-xs">
                  Loading conversation…
                </p>
              ) : null}

              {!bootstrapLoading &&
              messages.length === 0 &&
              !bootstrapError ? (
                <p className="text-muted-foreground px-1 text-center text-[13px] leading-snug">
                  Ask Conductor anything about this workspace.
                </p>
              ) : null}

              {grouped.flatMap((group) =>
                group.map((message, i) => (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    agentLabel="Conductor"
                    isLastInGroup={i === group.length - 1}
                    onQuestionAnswer={(qid, answer) =>
                      void handleSend(`[answer:${qid}] ${answer}`)
                    }
                  />
                )),
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border/60 px-3 pb-3 pt-2">
              <ChatInput
                onSend={handleSend}
                disabled={!sessionId || bootstrapLoading || isLoading}
              />
            </div>
          </div>
        </div>

      {/* Launcher */}
      <button
        type="button"
        onClick={() => setPanelOpen((o) => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex size-14 cursor-pointer items-center justify-center rounded-full",
          "border border-border bg-card shadow-lg shadow-black/25",
          "text-foreground/90 transition-transform hover:scale-[1.03] active:scale-[0.98]",
          conductorActive && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
        )}
        title="Chat with Conductor"
        aria-expanded={panelOpen}
        aria-label="Chat with Conductor"
      >
        {conductorActive ? (
          <span
            aria-hidden
            className="border-primary/50 absolute inset-0 rounded-full border-2 border-dashed animate-pulse"
          />
        ) : (
          <span
            aria-hidden
            className="border-white/10 absolute -inset-0.5 rounded-full border opacity-70"
          />
        )}
        <Bot className="relative size-[22px] text-primary" aria-hidden />
      </button>
    </>
  );
}
