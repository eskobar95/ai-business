"use client";

import { useCallback, useRef, useState } from "react";

export type MessageRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  stage?: string;
  thinking?: string;
  thinkingDone?: boolean;
  artifact?: {
    type: "document" | "react";
    title: string;
    content: string;
  };
  isStreaming?: boolean;
  createdAt: Date;
  /** Optional structured questions rendered inside the assistant bubble (e.g. from `initialMessages`). */
  questions?: Array<{ id: string; text: string; options?: string[] }>;
};

export type UseChatStreamReturn = {
  messages: ChatMessage[];
  isLoading: boolean;
  stage: string | null;
  send: (sessionId: string, businessId: string, text: string) => Promise<void>;
  initMessages: (msgs: ChatMessage[]) => void;
};

export function useChatStream(): UseChatStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const initMessages = useCallback((msgs: ChatMessage[]) => {
    setMessages(msgs);
  }, []);

  const send = useCallback(
    async (sessionId: string, businessId: string, text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setStage(null);

      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      abortRef.current = new AbortController();

      try {
        const res = await fetch(`/api/chat/${sessionId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, businessId }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) throw new Error("Stream failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const lines = part.split("\n");
            let eventType = "message";
            let dataLine = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) eventType = line.slice(7).trim();
              if (line.startsWith("data: ")) dataLine = line.slice(6).trim();
            }
            if (!dataLine) continue;

            let payload: Record<string, unknown>;
            try {
              payload = JSON.parse(dataLine) as Record<string, unknown>;
            } catch {
              continue;
            }

            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;

                switch (eventType) {
                  case "stage":
                    setStage(payload.label as string);
                    return { ...m, stage: payload.label as string };
                  case "thinking_start":
                    return { ...m, thinking: "", thinkingDone: false };
                  case "thinking_delta":
                    return {
                      ...m,
                      thinking: (m.thinking ?? "") + (payload.delta as string),
                    };
                  case "thinking_end":
                    return { ...m, thinkingDone: true };
                  case "text_delta":
                    return {
                      ...m,
                      content: m.content + (payload.delta as string),
                    };
                  case "artifact_start":
                    return {
                      ...m,
                      artifact: {
                        type: payload.artifactType as "document" | "react",
                        title: payload.title as string,
                        content: "",
                      },
                    };
                  case "artifact_delta":
                    if (!m.artifact) return m;
                    return {
                      ...m,
                      artifact: {
                        ...m.artifact,
                        content:
                          m.artifact.content + (payload.delta as string),
                      },
                    };
                  case "done":
                    return { ...m, isStreaming: false };
                  case "error":
                    return {
                      ...m,
                      content:
                        m.content || `Error: ${String(payload.message ?? "")}`,
                      isStreaming: false,
                    };
                  default:
                    return m;
                }
              }),
            );
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "Connection error. Please try again.",
                  isStreaming: false,
                }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
        setStage(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.isStreaming
              ? { ...m, isStreaming: false }
              : m,
          ),
        );
      }
    },
    [isLoading],
  );

  return { messages, isLoading, stage, send, initMessages };
}
