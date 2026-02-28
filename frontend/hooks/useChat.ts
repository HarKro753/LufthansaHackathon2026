"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  ChatMessage,
  ActivityItem,
  ContentBlock,
  StreamEvent,
  TimelineItem,
  Suggestion,
} from "@/types/chat";
import type { TripState } from "@/types/trip";

const API_BASE = "";

// Tool names that mutate the trip — when these complete, refetch the map
const TRIP_TOOLS = new Set([
  "create_trip",
  "add_to_trip",
  "update_trip",
  "remove_from_trip",
  "get_trip",
]);

interface UseChatOptions {
  onTripMutated?: (trip: TripState | null) => void;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  thinkingMessage: string | null;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => Promise<void>;
  clearError: () => void;
  activeSuggestions: Suggestion[];
  inputContent: string;
  setInputContent: (content: string) => void;
}

function genId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/** Fetch current trip state from the backend */
async function fetchTripState(): Promise<TripState | null> {
  try {
    const res = await fetch(`${API_BASE}/api/trip`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.trip ?? null;
  } catch {
    return null;
  }
}

/** Find a specific trip item by ID and return it as a TimelineItem */
function findTripItem(
  trip: TripState,
  itemId: string,
  itemType: string | null,
): TimelineItem | null {
  if (itemType === "flight" || !itemType) {
    const f = trip.flights.find((x) => x.id === itemId);
    if (f) return { itemType: "flight", data: f };
  }
  if (itemType === "stay" || !itemType) {
    const s = trip.stays.find((x) => x.id === itemId);
    if (s) return { itemType: "stay", data: s };
  }
  if (itemType === "route" || !itemType) {
    const r = trip.routes.find((x) => x.id === itemId);
    if (r) return { itemType: "route", data: r };
  }
  if (itemType === "activity" || !itemType) {
    const a = trip.activities.find((x) => x.id === itemId);
    if (a) return { itemType: "activity", data: a };
  }
  return null;
}

export function useChat(options?: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSuggestions, setActiveSuggestions] = useState<Suggestion[]>([]);
  const [inputContent, setInputContent] = useState<string>("");
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
      .then((res) => (res.ok ? res.json() : { messages: [], trip: null }))
      .then(
        (data: {
          messages: {
            role: string;
            content: string;
            timestamp: string;
            timeline_item_ids?: string[];
          }[];
          trip?: TripState | null;
        }) => {
          if (data.messages.length > 0) {
            const trip = data.trip ?? null;

            const restored: ChatMessage[] = data.messages.map((m, i) => {
              const base: ChatMessage = {
                id: `restored-${i}-${Date.now()}`,
                role: m.role as "user" | "assistant",
                content: m.content,
                timestamp: new Date(m.timestamp),
              };

              // Reconstruct timeline activities from persisted item IDs
              const itemIds = m.timeline_item_ids ?? [];
              if (m.role === "assistant" && itemIds.length > 0 && trip) {
                const idSet = new Set(itemIds);
                const timelineActivities: ActivityItem[] = [];

                for (const f of trip.flights) {
                  if (idSet.has(f.id)) {
                    timelineActivities.push({
                      type: "timeline",
                      data: { itemType: "flight", data: f },
                    });
                  }
                }
                for (const s of trip.stays) {
                  if (idSet.has(s.id)) {
                    timelineActivities.push({
                      type: "timeline",
                      data: { itemType: "stay", data: s },
                    });
                  }
                }
                for (const r of trip.routes) {
                  if (idSet.has(r.id)) {
                    timelineActivities.push({
                      type: "timeline",
                      data: { itemType: "route", data: r },
                    });
                  }
                }
                for (const a of trip.activities) {
                  if (idSet.has(a.id)) {
                    timelineActivities.push({
                      type: "timeline",
                      data: { itemType: "activity", data: a },
                    });
                  }
                }

                if (timelineActivities.length > 0) {
                  // Add content as trailing text after timeline cards
                  if (m.content.trim()) {
                    timelineActivities.push({
                      type: "content",
                      data: {
                        id: `restored-content-${i}`,
                        content: m.content,
                      },
                    });
                  }
                  base.activities = timelineActivities;
                }
              }

              return base;
            });
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

      setActiveSuggestions([]);
      setInputContent("");
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
      setThinkingMessage(null);
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
                const toolName = pendingToolNames.get(event.toolCallId);
                const isTripTool = toolName !== undefined && TRIP_TOOLS.has(toolName);

                // Mark the tool call as completed immediately
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantId) return msg;
                    return {
                      ...msg,
                      activities: msg.activities?.map((a) =>
                        a.type === "tool_call" &&
                        a.data.id === event.toolCallId
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

                // For trip-mutating tools: read itemId/itemType from the
                // event (sent as top-level fields by the backend), fetch
                // trip state, and inject a timeline card immediately.
                if (isTripTool) {
                  const itemId = event.itemId ?? null;
                  const itemType = event.itemType ?? null;

                  if (itemId) {
                    fetchTripState().then((trip) => {
                      if (!trip) {
                        onTripMutatedRef.current?.(null);
                        return;
                      }

                      const timelineItem = findTripItem(trip, itemId, itemType);
                      if (timelineItem) {
                        setMessages((prev) =>
                          prev.map((msg) => {
                            if (msg.id !== assistantId) return msg;
                            const alreadyAdded = msg.activities?.some(
                              (a) =>
                                a.type === "timeline" &&
                                "data" in a.data &&
                                a.data.data?.id === itemId,
                            );
                            if (alreadyAdded) return msg;

                            return {
                              ...msg,
                              activities: [
                                ...(msg.activities ?? []),
                                {
                                  type: "timeline" as const,
                                  data: timelineItem,
                                },
                              ],
                            };
                          }),
                        );
                      }
                      
                      onTripMutatedRef.current?.(trip);
                    });
                  } else {
                     fetchTripState().then((trip) => {
                        onTripMutatedRef.current?.(trip);
                     });
                  }
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
              } else if (event.type === "thinking" && event.content) {
                setThinkingMessage(event.content);
              } else if (event.type === "suggestions" && event.suggestions) {
                setActiveSuggestions(event.suggestions);
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
        setThinkingMessage(null);
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
    setActiveSuggestions([]);
    setInputContent("");
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    isLoading,
    thinkingMessage,
    error,
    sendMessage,
    clearMessages,
    clearError,
    activeSuggestions,
    inputContent,
    setInputContent,
  };
}
