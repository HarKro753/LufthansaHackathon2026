"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { useChat } from "@/hooks/useChat";
import { useTrip } from "@/hooks/useTrip";
import { TripMap } from "@/components/TripMap";
import { CalendarExport } from "@/components/CalendarExport";
import type { ChatMessage, ActivityItem, ToolCall } from "@/types/chat";

// ─── Markdown ────────────────────────────────────────────────────────────────

const md: Components = {
  h1: ({ children }) => <h1 className="text-2xl font-bold text-white mt-6 mb-4">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-bold text-white mt-5 mb-3">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h3>,
  p: ({ children }) => <p className="text-[15px] leading-relaxed text-[#ececec] mb-3">{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-[#d0d0d0]">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#58a6ff] hover:underline">
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 text-[#ececec]">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-[#ececec]">{children}</ol>,
  li: ({ children }) => <li className="text-[15px] leading-relaxed">{children}</li>,
  code: ({ className, children }) =>
    !className ? (
      <code className="bg-[#3a3a3a] px-1.5 py-0.5 rounded text-sm text-[#ff7b72] font-mono">{children}</code>
    ) : (
      <code className="block bg-[#1e1e1e] p-4 rounded-lg text-sm text-[#e6e6e6] font-mono overflow-x-auto my-3">
        {children}
      </code>
    ),
  pre: ({ children }) => <pre className="bg-[#1e1e1e] p-4 rounded-lg overflow-x-auto my-3">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-[#58a6ff] pl-4 py-2 my-3 bg-[#2a2a2a] rounded-r text-[#d0d0d0] italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border-collapse border border-[#444]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[#2a2a2a]">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-[#444]">{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-[#444]">{children}</tr>,
  th: ({ children }) => <th className="px-4 py-2 text-left text-sm font-semibold text-white border border-[#444]">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2 text-sm text-[#ececec] border border-[#444]">{children}</td>,
  hr: () => <hr className="border-[#444] my-4" />,
};

// ─── Tool names ───────────────────────────────────────────────────────────────

const toolDisplayNames: Record<string, string> = {
  search_flights: "Search Flights",
  search_hostels: "Search Hostels",
  search_places: "Google Places",
  google_search: "Google Search",
  get_routes: "Google Routes",
  create_trip: "Create Trip",
  add_to_trip: "Add to Trip",
  update_trip: "Update Trip",
  remove_from_trip: "Remove from Trip",
  get_trip: "View Trip",
  edit_context: "Save Preferences",
  read_context: "Read Preferences",
};

// ─── Thinking block ───────────────────────────────────────────────────────────

function ThinkingBlock({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-2 mb-3 p-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg">
      <svg className="w-4 h-4 text-[#a78bfa] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
      <p className="text-sm text-[#d0d0d0] leading-relaxed">{content}</p>
    </div>
  );
}

// ─── Tool call card ───────────────────────────────────────────────────────────

function ToolIcon({ name, status }: { name: string; status: ToolCall["status"] }) {
  if (status === "executing") {
    return (
      <svg className="w-4 h-4 animate-spin text-[#58a6ff]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg className="w-4 h-4 text-[#f87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  if (name === "search_places") {
    return (
      <svg className="w-4 h-4 text-[#19C37D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-[#19C37D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function formatJson(data: unknown): string {
  try {
    if (typeof data === "string") {
      try { return JSON.stringify(JSON.parse(data), null, 2); } catch { return data; }
    }
    return JSON.stringify(data, null, 2);
  } catch { return String(data); }
}

function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const displayName = toolDisplayNames[toolCall.name] ?? toolCall.name;
  const args = toolCall.arguments as Record<string, string | undefined>;

  const statusText = () => {
    if (toolCall.status === "executing") {
      const q = args.textQuery ?? args.query ?? args.q;
      return q ? `Searching for "${q}"...` : `Calling ${displayName}...`;
    }
    if (toolCall.status === "error") return `Failed — ${displayName}`;
    const q = args.textQuery ?? args.query ?? args.q;
    return q ? `Searched "${q}" via ${displayName}` : `Done — ${displayName}`;
  };

  return (
    <div className={`mb-3 rounded-lg border transition-all ${
      toolCall.status === "error" ? "border-[#f87171]/30 bg-[#2a1f1f]"
      : toolCall.status === "executing" ? "border-[#58a6ff]/30 bg-[#1f2937]"
      : "border-[#444] bg-[#2a2a2a]"
    }`}>
      <button
        onClick={() => toolCall.status !== "executing" && setExpanded(!expanded)}
        disabled={toolCall.status === "executing"}
        className={`w-full px-4 py-3 flex items-center justify-between text-left rounded-lg transition-colors ${
          toolCall.status === "executing" ? "cursor-default" : "cursor-pointer hover:bg-[#333]"
        }`}
      >
        <div className="flex items-center gap-3">
          <ToolIcon name={toolCall.name} status={toolCall.status} />
          <span className="text-sm text-[#ececec]">{statusText()}</span>
        </div>
        {toolCall.status !== "executing" && (
          <svg className={`w-4 h-4 text-[#8e8ea0] transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {expanded && toolCall.status !== "executing" && (
        <div className="border-t border-[#444] px-4 py-3 space-y-3">
          <div>
            <div className="text-xs font-medium text-[#8e8ea0] mb-1.5 uppercase tracking-wide">Input</div>
            <pre className="text-xs text-[#d0d0d0] bg-[#1e1e1e] p-3 rounded-md overflow-x-auto font-mono">
              {formatJson(toolCall.arguments)}
            </pre>
          </div>
          {(toolCall.result ?? toolCall.error) && (
            <div>
              <div className="text-xs font-medium text-[#8e8ea0] mb-1.5 uppercase tracking-wide">Output</div>
              {toolCall.error ? (
                <div className="text-xs text-[#f87171] bg-[#1e1e1e] p-3 rounded-md">{toolCall.error}</div>
              ) : (
                <pre className="text-xs text-[#d0d0d0] bg-[#1e1e1e] p-3 rounded-md overflow-x-auto font-mono max-h-64 overflow-y-auto">
                  {formatJson(toolCall.result)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Activity renderer ────────────────────────────────────────────────────────

function ActivityRenderer({ item }: { item: ActivityItem }) {
  if (item.type === "thinking") return <ThinkingBlock content={item.data.content} />;
  if (item.type === "content") {
    return (
      <div className="prose prose-invert max-w-none mb-3">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
          {item.data.content}
        </ReactMarkdown>
      </div>
    );
  }
  return <ToolCallCard toolCall={item.data} />;
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const hasActivities = (message.activities?.length ?? 0) > 0;
  const hasContentActivities = message.activities?.some((a) => a.type === "content");

  return (
    <div className="py-4">
      <div className="max-w-full mx-auto px-4 flex gap-3">
        <div className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
          isUser ? "bg-[#5436DA]" : "bg-[#1a73e8]"
        } text-white`}>
          {isUser ? "H" : "LH"}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          {isUser ? (
            <p className="text-[15px] leading-relaxed text-[#ececec] whitespace-pre-wrap break-words">
              {message.content}
            </p>
          ) : (
            <>
              {hasActivities && (
                <div className="mb-2">
                  {message.activities!.map((item, i) => (
                    <ActivityRenderer key={`${item.data.id}-${i}`} item={item} />
                  ))}
                </div>
              )}
              {message.content && !hasContentActivities && (
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
              {!hasActivities && !message.content && (
                <div className="flex gap-1 pt-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 bg-[#6b6b6b] rounded-full animate-pulse"
                      style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const { trip, refetch: refetchTrip } = useTrip();
  const { messages, isLoading, error, sendMessage, clearMessages, clearError } = useChat({
    onTripMutated: refetchTrip,
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex h-screen" style={{ background: "#212121", color: "#ececec" }}>
      {/* ─── Left: Chat Panel ─── */}
      <div className="flex flex-col w-1/2 min-w-[380px] border-r border-white/10">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <span className="text-sm font-medium text-white/60">LH Travel Agent</span>
          <div className="flex items-center gap-2">
            <CalendarExport trip={trip} />
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1.5 rounded hover:bg-white/5"
              >
                New chat
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: "#1a73e8" }}>
                LH
              </div>
              <h1 className="text-2xl font-semibold text-white/90">What can I help with?</h1>
              <p className="text-sm text-white/40">Powered by Lufthansa x Google ADK</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="py-4">
                  <div className="max-w-full mx-auto px-4 flex gap-3">
                    <div className="w-7 h-7 rounded-sm bg-[#1a73e8] flex items-center justify-center text-xs font-bold text-white">LH</div>
                    <div className="flex gap-1 pt-3">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="w-1.5 h-1.5 bg-[#6b6b6b] rounded-full animate-pulse"
                          style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-3 mb-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm flex justify-between items-center shrink-0">
            <span>{error}</span>
            <button onClick={clearError} className="ml-3 text-red-300/70 hover:text-red-300">✕</button>
          </div>
        )}

        {/* Input */}
        <div className="px-3 pb-4 pt-2 shrink-0">
          <div className="flex items-end gap-2 rounded-2xl px-4 py-3" style={{ background: "#2f2f2f" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={() => {
                const el = textareaRef.current;
                if (!el) return;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
              }}
              placeholder="Plan your trip..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none bg-transparent text-sm text-white/90 placeholder-white/30 outline-none leading-6"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
              style={{ background: input.trim() && !isLoading ? "#fff" : "#444" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 12V2M7 2L3 6M7 2L11 6"
                  stroke={input.trim() && !isLoading ? "#000" : "#666"}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <p className="text-center text-xs text-white/20 mt-2">
            LH Travel Agent · Verify flight details before booking
          </p>
        </div>
      </div>

      {/* ─── Right: Map Panel ─── */}
      <div className="flex-1 relative">
        <TripMap trip={trip} />
      </div>
    </div>
  );
}
