"use client";

import { Bot, KeyRound, Loader2, MessageSquare, Settings, X } from "lucide-react";
import Link from "next/link";
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

function isApiKeyError(messages: ChatMessage[]): boolean {
  const last = messages[messages.length - 1];
  return !!(
    last?.role === "assistant" &&
    (last.content.includes("API key") || last.content.includes("402") || last.content.includes("Cursor API"))
  );
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
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setSessionId(null);
    initMessages([]);
    setBootstrapError(null);
    setUnread(0);
  }, [businessId, conductorAgentId, initMessages]);

  useEffect(() => {
    if (!panelOpen || sessionId !== null) return;
    let cancelled = false;

    async function bootstrap() {
      setBootstrapLoading(true);
      setBootstrapError(null);
      let stored: string | null = null;
      try { stored = localStorage.getItem(storageKey); } catch { /* ignore */ }

      try {
        const res = await ensureWidgetChatSession(businessId, conductorAgentId, stored);
        if (cancelled) return;
        setSessionId(res.sessionId);
        try { localStorage.setItem(storageKey, res.sessionId); } catch { /* ignore */ }
        initMessages(res.initialMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt as unknown as string),
        })));
      } catch (e) {
        if (!cancelled) setBootstrapError(e instanceof Error ? e.message : "Could not start chat");
      } finally {
        if (!cancelled) setBootstrapLoading(false);
      }
    }

    void bootstrap();
    return () => { cancelled = true; };
  }, [panelOpen, sessionId, businessId, conductorAgentId, storageKey, initMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (!panelOpen && messages.length > 0) setUnread((n) => n + 1);
  }, [messages, panelOpen]);

  useEffect(() => {
    if (panelOpen) setUnread(0);
  }, [panelOpen]);

  const grouped = useMemo(() => chunkByRole(messages), [messages]);
  const showApiKeyHint = isApiKeyError(messages);

  const handleSend = useCallback(
    (text: string) => {
      if (!sessionId) return;
      void send(sessionId, businessId, text);
    },
    [businessId, send, sessionId],
  );

  return (
    <>
      {/* ── Panel ── */}
      <div
        className={cn(
          "fixed right-5 z-50 flex flex-col overflow-hidden transition-all duration-300 ease-out",
          "bottom-[4.5rem] w-[370px] max-w-[calc(100vw-1.5rem)]",
          "rounded-2xl border border-white/[0.08] bg-[#0f0f11] shadow-[0_24px_64px_-8px_rgba(0,0,0,0.7)]",
          "max-h-[min(540px,78vh)]",
          panelOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0",
        )}
        aria-hidden={!panelOpen}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          {/* Subtle gradient top bar */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex items-center gap-3">
            <div className="relative flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Bot className="size-[15px] text-primary" />
              {/* Status dot */}
              <span className={cn(
                "absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[#0f0f11]",
                isLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-400",
              )} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-none tracking-tight text-foreground">Conductor</p>
              <p className="mt-0.5 text-[10px] leading-none text-muted-foreground/70">
                {isLoading ? "Thinking…" : "Platform orchestrator"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={`/dashboard/chats?businessId=${businessId}`}
              onClick={() => setPanelOpen(false)}
              className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-white/[0.05] hover:text-foreground"
              title="Open full chat"
            >
              <MessageSquare className="size-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-white/[0.05] hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {bootstrapError && (
            <div className="mx-1 mb-3 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-center text-[12px] text-destructive/90">
              {bootstrapError}
            </div>
          )}

          {bootstrapLoading && messages.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-muted-foreground/50">
              <Loader2 className="size-3.5 animate-spin" />
              Loading conversation…
            </div>
          )}

          {!bootstrapLoading && messages.length === 0 && !bootstrapError && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/8 ring-1 ring-primary/15">
                <Bot className="size-5 text-primary/70" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground/80">Ask Conductor anything</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/50">
                  Status checks, next steps, mission setup
                </p>
              </div>
            </div>
          )}

          <div className="space-y-0.5">
            {grouped.flatMap((group) =>
              group.map((message, i) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  agentLabel="Conductor"
                  isFirstInGroup={i === 0}
                  isLastInGroup={i === group.length - 1}
                  onQuestionAnswer={(qid, answer) => void handleSend(`[answer:${qid}] ${answer}`)}
                />
              )),
            )}
          </div>

          {/* API key hint */}
          {showApiKeyHint && (
            <Link
              href="/dashboard/settings"
              onClick={() => setPanelOpen(false)}
              className="mx-1 mt-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-[12px] text-amber-400/90 transition-colors hover:bg-amber-500/12"
            >
              <KeyRound className="size-3.5 shrink-0" />
              <span>Add your Cursor API key in <strong>Settings</strong> to enable chat</span>
              <Settings className="ml-auto size-3 shrink-0 opacity-60" />
            </Link>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-white/[0.06] bg-[#0f0f11] px-3 pb-7 pt-2.5">
          <ChatInput
            onSend={handleSend}
            disabled={!sessionId || bootstrapLoading || isLoading}
            compact
          />
        </div>
      </div>

      {/* ── Launcher button ── */}
      <button
        type="button"
        onClick={() => setPanelOpen((o) => !o)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex size-13 cursor-pointer items-center justify-center rounded-2xl",
          "bg-[#0f0f11] shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)]",
          "border border-white/[0.08] ring-1 ring-inset ring-white/[0.04]",
          "transition-all duration-200 hover:scale-[1.05] hover:shadow-[0_12px_40px_-4px_rgba(0,0,0,0.7)] active:scale-[0.97]",
          panelOpen && "bg-primary/10 border-primary/25",
        )}
        title="Chat with Conductor"
        aria-expanded={panelOpen}
        aria-label="Chat with Conductor"
      >
        {/* Glow */}
        <span className={cn(
          "absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300",
          "bg-[radial-gradient(ellipse_at_center,rgba(var(--primary)/0.15),transparent_70%)]",
          (isLoading || panelOpen) && "opacity-100",
        )} />

        {/* Active ring */}
        {isLoading && (
          <span className="absolute -inset-1 rounded-[18px] border border-primary/30 animate-pulse" />
        )}

        <Bot className={cn(
          "relative size-5 transition-colors duration-200",
          panelOpen ? "text-primary" : "text-foreground/70",
        )} />

        {/* Unread badge */}
        {unread > 0 && !panelOpen && (
          <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground" style={{ height: 18 }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </>
  );
}
