"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useChat } from "@/hooks/useChat";

export default function Page() {
  const { messages, isLoading, error, sendMessage, clearMessages } = useChat();
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  return (
    <div className="flex flex-col h-screen" style={{ background: "#212121", color: "#ececec" }}>
      {/* Header — only show when there are messages */}
      {messages.length > 0 && (
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-medium text-white/60">LH Travel Agent</span>
          <button
            onClick={clearMessages}
            className="text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded"
          >
            New chat
          </button>
        </header>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Welcome screen */
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: "#1a73e8" }}
            >
              LH
            </div>
            <h1 className="text-2xl font-semibold text-white/90">What can I help with?</h1>
            <p className="text-sm text-white/40">Powered by Lufthansa × Google ADK</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-3 items-start">
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{
                    background: msg.role === "user" ? "#5436DA" : "#1a73e8",
                  }}
                >
                  {msg.role === "user" ? "H" : "LH"}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  {msg.content ? (
                    <p className="text-sm leading-7 whitespace-pre-wrap break-words text-white/90">
                      {msg.content}
                    </p>
                  ) : (
                    /* Streaming dots */
                    <div className="flex gap-1 pt-2">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-2 h-2 rounded-full bg-white/30"
                          style={{
                            animation: "pulse 1.2s ease-in-out infinite",
                            animationDelay: `${i * 0.2}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator (assistant thinking) */}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3 items-start">
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                  style={{ background: "#1a73e8" }}
                >
                  LH
                </div>
                <div className="flex gap-1 pt-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-white/30"
                      style={{
                        animation: "pulse 1.2s ease-in-out infinite",
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => {}}
            className="ml-3 text-red-300/70 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 pb-4 pt-2 max-w-2xl mx-auto w-full">
        <div
          className="flex items-end gap-2 rounded-2xl px-4 py-3"
          style={{ background: "#2f2f2f" }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Plan your trip..."
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none bg-transparent text-sm text-white/90 placeholder-white/30 outline-none leading-6"
            style={{ maxHeight: "200px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              background: input.trim() && !isLoading ? "#fff" : "#444",
              cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{ color: input.trim() && !isLoading ? "#000" : "#666" }}
            >
              <path
                d="M8 3L8 13M8 3L4 7M8 3L12 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-white/20 mt-2">
          LH Travel Agent · Powered by Google ADK + Gemini
        </p>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
