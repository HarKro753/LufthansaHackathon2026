"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  ChatMessage,
  ActivityItem,
  ContentBlock,
  StreamEvent,
} from "@/types/chat";

const API_BASE = "http://localhost:8000";

// Tool names that mutate the trip — when these complete, refetch the map
const TRIP_TOOLS = new Set([
  "create_trip",
  "add_to_trip",
  "update_trip",
  "remove_from_trip",
  "get_trip",
]);

interface UseChatOptions {
  onTripMutated?: () => void;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => Promise<void>;
  clearError: () => void;
}

function genId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function useChat(options?: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onTripMutatedRef = useRef(options?.onTripMutated);
  const initializedRef = useRef(false);

  // Keep callback ref fresh
  onTripMutatedRef.current = options?.onTripMutated;

  // On mount: restore chat history from the backend session
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    fetch(`${API_BASE}/api/session/history`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then(
        (data: {
          messages: { role: string; content: string; timestamp: string }[];
        }) => {
          if (data.messages.length > 0) {
            const restored: ChatMessage[] = data.messages.map((m, i) => ({
              id: `restored-${i}-${Date.now()}`,
              role: m.role as "user" | "assistant",
              content: m.content,
              timestamp: new Date(m.timestamp),
            }));
            setMessages(restored);
          }
        },
      )
      .catch(() => {
        // Backend down — no history to restore
      });
  }, []);

  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      if (!content.trim() || isLoading) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const userMsg: ChatMessage = {
        id: genId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };
      const assistantId = genId();

      // Track which tool calls are in-flight so we can trigger refetch on complete
      const pendingToolNames = new Map<string, string>();

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messages: [...messages, userMsg].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to send message");
        }
        if (!res.body) throw new Error("No response body");

        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
          },
        ]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            try {
              const event: StreamEvent = JSON.parse(raw);

              if (event.type === "content" && event.content) {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantId) return msg;
                    const newContent = msg.content + event.content!;
                    const acts = msg.activities ?? [];

                    if (acts.length > 0) {
                      const last = acts[acts.length - 1];
                      if (last?.type === "content") {
                        return {
                          ...msg,
                          content: newContent,
                          activities: [
                            ...acts.slice(0, -1),
                            {
                              ...last,
                              data: {
                                ...last.data,
                                content: last.data.content + event.content!,
                              },
                            },
                          ],
                        };
                      }
                      const block: ActivityItem = {
                        type: "content",
                        data: {
                          id: genId(),
                          content: event.content!,
                        } as ContentBlock,
                      };
                      return {
                        ...msg,
                        content: newContent,
                        activities: [...acts, block],
                      };
                    }
                    return { ...msg, content: newContent };
                  }),
                );
              } else if (event.type === "thinking" && event.content) {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantId) return msg;
                    const acts = msg.activities ?? [];
                    const last = acts[acts.length - 1];
                    if (last?.type === "thinking") {
                      return {
                        ...msg,
                        activities: [
                          ...acts.slice(0, -1),
                          {
                            ...last,
                            data: {
                              ...last.data,
                              content: last.data.content + event.content!,
                            },
                          },
                        ],
                      };
                    }
                    return {
                      ...msg,
                      activities: [
                        ...acts,
                        {
                          type: "thinking",
                          data: { id: genId(), content: event.content! },
                        },
                      ],
                    };
                  }),
                );
              } else if (event.type === "tool_call_start" && event.toolCall) {
                pendingToolNames.set(event.toolCall.id, event.toolCall.name);

                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantId) return msg;
                    const exists = msg.activities?.find(
                      (a) =>
                        a.type === "tool_call" &&
                        a.data.id === event.toolCall!.id,
                    );
                    if (exists) return msg;
                    return {
                      ...msg,
                      activities: [
                        ...(msg.activities ?? []),
                        {
                          type: "tool_call",
                          data: {
                            id: event.toolCall!.id,
                            name: event.toolCall!.name,
                            arguments: event.toolCall!.arguments,
                            status: "executing" as const,
                          },
                        },
                      ],
                    };
                  }),
                );
              } else if (event.type === "tool_call_args" && event.toolCallId) {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantId) return msg;
                    return {
                      ...msg,
                      activities: msg.activities?.map((a) =>
                        a.type === "tool_call" && a.data.id === event.toolCallId
                          ? {
                              ...a,
                              data: { ...a.data, arguments: event.arguments! },
                            }
                          : a,
                      ),
                    };
                  }),
                );
              } else if (
                event.type === "tool_call_complete" &&
                event.toolCallId
              ) {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantId) return msg;
                    return {
                      ...msg,
                      activities: msg.activities?.map((a) =>
                        a.type === "tool_call" && a.data.id === event.toolCallId
                          ? {
                              ...a,
                              data: {
                                ...a.data,
                                status: "completed" as const,
                                result: event.result,
                              },
                            }
                          : a,
                      ),
                    };
                  }),
                );

                // If this was a trip-mutating tool, trigger immediate map refetch
                const toolName = pendingToolNames.get(event.toolCallId);
                if (toolName && TRIP_TOOLS.has(toolName)) {
                  onTripMutatedRef.current?.();
                }
              } else if (event.type === "tool_call_error" && event.toolCallId) {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantId) return msg;
                    return {
                      ...msg,
                      activities: msg.activities?.map((a) =>
                        a.type === "tool_call" && a.data.id === event.toolCallId
                          ? {
                              ...a,
                              data: {
                                ...a.data,
                                status: "error" as const,
                                error: event.error,
                              },
                            }
                          : a,
                      ),
                    };
                  }),
                );
              } else if (event.type === "error") {
                throw new Error(event.error ?? "Unknown error");
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages, isLoading],
  );

  const clearMessages = useCallback(async (): Promise<void> => {
    abortRef.current?.abort();
    try {
      await fetch(`${API_BASE}/api/session`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {}
    setMessages([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { messages, isLoading, error, sendMessage, clearMessages, clearError };
}
