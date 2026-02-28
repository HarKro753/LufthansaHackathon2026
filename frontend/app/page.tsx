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
import { motion } from "motion/react";
import { InteractiveBackground } from "@/components/InteractiveBackground";
import { TimelineCard } from "@/components/TimelineCard";
import StepIndicator from "@/components/onboarding/StepIndicator";
import LoadingScreen from "@/components/onboarding/LoadingScreen";
import ProfileGenerationLoadingScreen from "@/components/onboarding/ProfileGenerationLoadingScreen";
import TravelDNAStep from "@/components/onboarding/TravelDNAStep";
import MovementStep from "@/components/onboarding/MovementStep";
import WorldStep from "@/components/onboarding/WorldStep";
import StyleStep from "@/components/onboarding/StyleStep";
import SuggestionsStep from "@/components/onboarding/SuggestionsStep";
import SuggestionChips from "@/components/SuggestionChips";

// ─── Markdown components ──────────────────────────────────────────────────────

// ─── Onboarding types ─────────────────────────────────────────────────────────

const STEP_LABELS = ["Sign In", "DNA", "Movement", "World", "Style", "Trips"];

interface ApiResponse {
  email?: string;
  profile: {
    home_city: string;
    primary_transport: string;
    transport_breakdown: { mode: string; trips: number; total_km: number; total_hours: number }[];
    total_flights: number;
    top_destinations: { city: string; visits: number }[];
    geographic_diversity: number;
    preferences: string[];
    travel_season: string;
    date_range: { start: string; end: string };
    traveler_type: string;
    traveler_tagline: string;
    total_km: number;
    commute_avg_km: number;
    commute_avg_min: number;
    daily_rhythm: string;
    routine_score: number;
    weekend_explorer: boolean;
    flights_per_month: number;
    month_distribution: Record<string, number>;
    weekday_distribution: Record<string, number>;
    hour_distribution: Record<string, number>;
  };
  flights: {
    date: string;
    origin: string;
    destination: string;
    duration_hrs: number;
    distance_km: number;
  }[];
  suggestions: {
    city: string;
    region: string;
    tags: string[];
    transport: string;
    score: number;
    already_visited: boolean;
    reasons: string[];
    best_months: string[];
  }[];
  meta: {
    processing_time_sec: number;
    total_segments: number;
    kept_segments: number;
  };
}

// ─── Markdown components ──────────────────────────────────────────────────────

const md: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-4">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold text-gray-900 mt-5 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-[15px] leading-relaxed text-gray-700 mb-3">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#FF385C] hover:underline"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside mb-3 space-y-1 text-gray-700">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-700">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-[15px] leading-relaxed">{children}</li>
  ),
  code: ({ className, children }) =>
    !className ? (
      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm text-pink-600 font-mono">
        {children}
      </code>
    ) : (
      <code className="block bg-gray-50 p-4 rounded-lg text-sm text-gray-800 font-mono overflow-x-auto my-3 border border-gray-100">
        {children}
      </code>
    ),
  pre: ({ children }) => (
    <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto my-3 border border-gray-100">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-purple-400 pl-4 py-2 my-3 bg-[#FFF0F3] rounded-r text-gray-600 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border-collapse border border-gray-200">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
  tbody: ({ children }) => (
    <tbody className="divide-y divide-gray-200">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-gray-200">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900 border border-gray-200">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2 text-sm text-gray-700 border border-gray-200">
      {children}
    </td>
  ),
  hr: () => <hr className="border-gray-200 my-4" />,
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

/** Friendly loading messages shown while a tool is executing */
const toolLoadingMessages: Record<string, string> = {
  search_flights: "Searching for flights",
  search_hostels: "Finding hotels & stays",
  search_places: "Searching for places",
  google_search: "Looking things up",
  get_routes: "Finding the best route",
  create_trip: "Creating your trip",
  add_to_trip: "Adding to your trip",
  update_trip: "Updating your trip",
  remove_from_trip: "Removing from trip",
  get_trip: "Loading your trip",
  edit_context: "Saving your preferences",
  read_context: "Reading your preferences",
};

// ─── Animated SVG Loading dots ────────────────────────────────────────────────

function BouncingDots() {
  return (
    <svg
      className="w-8 h-4 shrink-0"
      viewBox="0 0 32 12"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="4" cy="6" r="3" fill="#FF91A4">
        <animate
          attributeName="cy"
          calcMode="spline"
          dur="0.7s"
          values="6;2;6"
          keySplines=".33,.66,.66,1;.33,0,.66,.33"
          begin="0s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="16" cy="6" r="3" fill="#FF385C">
        <animate
          attributeName="cy"
          calcMode="spline"
          dur="0.7s"
          values="6;2;6"
          keySplines=".33,.66,.66,1;.33,0,.66,.33"
          begin="0.12s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="28" cy="6" r="3" fill="#FF385C">
        <animate
          attributeName="cy"
          calcMode="spline"
          dur="0.7s"
          values="6;2;6"
          keySplines=".33,.66,.66,1;.33,0,.66,.33"
          begin="0.24s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

function LoadingAnimation() {
  return (
    <div className="flex items-center gap-1 py-2">
      <BouncingDots />
    </div>
  );
}

/** Loading indicator with contextual text based on the currently executing tool */
function LoadingStatus({ activities }: { activities: ActivityItem[] }) {
  // Find the last tool call that is still executing
  const executingTools = activities.filter(
    (a): a is ActivityItem & { type: "tool_call" } =>
      a.type === "tool_call" && a.data.status === "executing",
  );
  const lastExecuting =
    executingTools.length > 0
      ? executingTools[executingTools.length - 1]
      : null;

  const toolName = lastExecuting?.data.name ?? "";
  const message = toolLoadingMessages[toolName] ?? "Thinking";

  return (
    <div className="flex items-center gap-2 py-2 mb-2">
      <span className="text-sm text-gray-400">{message}</span>
      <BouncingDots />
    </div>
  );
}

// ─── Thinking block ───────────────────────────────────────────────────────────

function ThinkingBlock({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-2 mb-3 p-3 bg-[#FFF0F3] border border-[#FFB3C1] rounded-xl">
      <svg
        className="w-4 h-4 text-[#FF385C] mt-0.5 shrink-0 animate-pulse"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
      <p className="text-sm text-[#cc1c40] leading-relaxed">{content}</p>
    </div>
  );
}

// ─── Tool icons ───────────────────────────────────────────────────────────────

function ToolIcon({
  name,
  status,
}: {
  name: string;
  status: ToolCall["status"];
}) {
  if (status === "executing") {
    return (
      <svg
        className="w-4 h-4 text-[#FF385C] animate-spin"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg
        className="w-4 h-4 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  }
  if (name === "search_places" || name === "google_search") {
    return (
      <svg
        className="w-4 h-4 text-[#FF385C]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    );
  }
  return (
    <svg
      className="w-4 h-4 text-emerald-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function formatJson(data: unknown): string {
  try {
    if (typeof data === "string") {
      try {
        return JSON.stringify(JSON.parse(data), null, 2);
      } catch {
        return data;
      }
    }
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

// ─── Tool call card ───────────────────────────────────────────────────────────

function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const displayName = toolDisplayNames[toolCall.name] ?? toolCall.name;
  const args = toolCall.arguments as Record<string, string | undefined>;

  const statusText = () => {
    if (toolCall.status === "executing") {
      const q = args.textQuery ?? args.query ?? args.q;
      return q ? `Searching for "${q}"...` : `Working on ${displayName}...`;
    }
    if (toolCall.status === "error") return `Failed: ${displayName}`;
    const q = args.textQuery ?? args.query ?? args.q;
    return q ? `Found results for "${q}"` : `Completed ${displayName}`;
  };

  return (
    <div
      className={`mb-3 rounded-xl border transition-all ${
        toolCall.status === "error"
          ? "border-red-200 bg-red-50"
          : toolCall.status === "executing"
            ? "border-[#FFB3C1] bg-[#FFF0F3]"
            : "border-gray-100 bg-white shadow-sm"
      }`}
    >
      <button
        onClick={() =>
          toolCall.status !== "executing" && setExpanded(!expanded)
        }
        disabled={toolCall.status === "executing"}
        className={`w-full px-4 py-3 flex items-center justify-between text-left rounded-xl transition-colors ${
          toolCall.status === "executing"
            ? "cursor-default"
            : "cursor-pointer hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <ToolIcon name={toolCall.name} status={toolCall.status} />
          <span
            className={`text-sm font-medium ${
              toolCall.status === "executing"
                ? "text-[#cc1c40]"
                : "text-gray-700"
            }`}
          >
            {statusText()}
          </span>
        </div>
        {toolCall.status !== "executing" && (
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </button>
      {expanded && toolCall.status !== "executing" && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50 rounded-b-xl">
          <div>
            <div className="text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Input
            </div>
            <pre className="text-[11px] text-gray-600 bg-white border border-gray-200 p-3 rounded-lg overflow-x-auto font-mono">
              {formatJson(toolCall.arguments)}
            </pre>
          </div>
          {(toolCall.result ?? toolCall.error) && (
            <div>
              <div className="text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Output
              </div>
              {toolCall.error ? (
                <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg">
                  {toolCall.error}
                </div>
              ) : (
                <pre className="text-[11px] text-gray-600 bg-white border border-gray-200 p-3 rounded-lg overflow-x-auto font-mono max-h-64 overflow-y-auto">
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

/** Check if ANY tool call in the activities list is still executing */
function hasExecutingToolCall(activities: ActivityItem[]): boolean {
  return activities.some(
    (a) => a.type === "tool_call" && a.data.status === "executing",
  );
}

function ActivityRenderer({
  item,
  isLastTimeline,
}: {
  item: ActivityItem;
  isLastTimeline: boolean;
}) {
  // Hide thinking, tool_call, and content — content only renders as trailing text
  if (item.type === "thinking") return null;
  if (item.type === "tool_call") return null;
  if (item.type === "content") return null;

  if (item.type === "timeline") {
    return <TimelineCard item={item.data} isLast={isLastTimeline} />;
  }

  return null;
}

// ─── Collapsible text block ────────────────────────────────────────────────────

function CollapsibleText({
  content,
  defaultCollapsed,
}: {
  content: string;
  defaultCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (!content) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        Show response
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setCollapsed(true)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1 mb-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
        Hide response
      </button>
      <div className="prose prose-sm prose-slate max-w-none text-gray-800">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isStreaming,
  isLast,
}: {
  message: ChatMessage;
  isStreaming: boolean;
  isLast: boolean;
}) {
  const isUser = message.role === "user";
  const activities = message.activities ?? [];
  const hasTimeline = activities.some((a) => a.type === "timeline");

  // Show loading whenever the stream is active and a tool is running,
  // OR when the stream is active but nothing visible has appeared yet
  const isWorking =
    isStreaming &&
    (hasExecutingToolCall(activities) || !hasTimeline);

  // Find the last timeline item for the connector line
  const timelineItems = activities.filter((a) => a.type === "timeline");
  const lastTimelineId =
    timelineItems.length > 0
      ? timelineItems[timelineItems.length - 1].data
      : null;

  // Text content: use raw message content (accumulated from all content events)
  // Only show text AFTER streaming is done — never during
  const textContent = !isStreaming ? message.content : "";

  // Collapse text in older messages that also have timeline cards
  const shouldCollapse = !isLast && hasTimeline;

  if (isUser) {
    return (
      <div className="py-3 px-4 flex justify-end">
        <div className="bg-black text-white px-5 py-3 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="max-w-full mx-auto px-4">
        {/* Timeline cards */}
        {timelineItems.length > 0 && (
          <div className="mb-2">
            {activities.map((item, i) => {
              if (item.type !== "timeline") return null;
              const isLastTl = item.data === lastTimelineId;
              return (
                <ActivityRenderer
                  key={`tl-${item.data.itemType}-${item.data.data.id}-${i}`}
                  item={item}
                  isLastTimeline={isLastTl}
                />
              );
            })}
          </div>
        )}

        {/* Loading status — only bouncing dots + context text */}
        {isWorking && <LoadingStatus activities={activities} />}

        {/* Text — hidden during streaming, collapsible for older messages */}
        {textContent && (
          shouldCollapse ? (
            <CollapsibleText content={textContent} defaultCollapsed />
          ) : (
            <div className="prose prose-sm prose-slate max-w-none text-gray-800 mt-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                {textContent}
              </ReactMarkdown>
            </div>
          )
        )}

        {/* Initial loading — empty assistant message, stream just started */}
        {isStreaming && !activities.length && !message.content && (
          <LoadingAnimation />
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  // ─── Onboarding state ─────────────────────────────────────────────────────
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [obStep, setObStep] = useState(0);
  const [obEmail, setObEmail] = useState("");
  const [obResult, setObResult] = useState<ApiResponse | null>(null);
  const [obError, setObError] = useState("");
  const [obLoadingStep, setObLoadingStep] = useState(0);
  const [obIsLoading, setObIsLoading] = useState(false);
  const [obGeneratingProfile, setObGeneratingProfile] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ─── Chat state ───────────────────────────────────────────────────────────
  const { trip, refetch: refetchTrip } = useTrip();
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    clearError,
    activeSuggestions,
    inputContent,
    setInputContent,
  } = useChat({
    onTripMutated: refetchTrip,
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ─── Onboarding handlers ──────────────────────────────────────────────────
  const handleObLogin = async () => {
    if (!obEmail.trim()) return;
    setObIsLoading(true);
    setObLoadingStep(0);
    setObError("");

    const stepTimer = setInterval(() => {
      setObLoadingStep((prev) => Math.min(prev + 1, 4));
    }, 500);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: obEmail.trim() }),
      });

      clearInterval(stepTimer);

      if (!res.ok) {
        let msg = "Login failed";
        try {
          const errData = await res.json();
          msg = errData.detail || msg;
        } catch {
          msg = `Server error (${res.status}). Is the backend running?`;
        }
        throw new Error(msg);
      }

      const data: ApiResponse = await res.json();
      setObResult(data);
      setObLoadingStep(5);
      setTimeout(() => {
        setObIsLoading(false);
        setObStep(1);
      }, 400);
    } catch (err: unknown) {
      clearInterval(stepTimer);
      setObError(err instanceof Error ? err.message : "Something went wrong");
      setObIsLoading(false);
    }
  };

  const handleObUpload = async () => {
    if (!selectedFile) return;
    setObIsLoading(true);
    setObLoadingStep(0);
    setObError("");

    const stepTimer = setInterval(() => {
      setObLoadingStep((prev) => Math.min(prev + 1, 4));
    }, 600);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(stepTimer);

      if (!res.ok) {
        let msg = "Upload failed";
        try {
          const errData = await res.json();
          msg = errData.detail || msg;
        } catch {
          msg = `Server error (${res.status}). Is the backend running?`;
        }
        throw new Error(msg);
      }

      const data: ApiResponse = await res.json();
      setObResult(data);
      setObLoadingStep(5);
      setTimeout(() => {
        setObIsLoading(false);
        setObStep(1);
      }, 400);
    } catch (err: unknown) {
      clearInterval(stepTimer);
      setObError(err instanceof Error ? err.message : "Something went wrong");
      setObIsLoading(false);
    }
  };

  const handleObKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleObLogin();
  };

  const handleUpdatePreferences = (prefs: string[]) => {
    if (obResult) {
      setObResult({
        ...obResult,
        profile: { ...obResult.profile, preferences: prefs },
      });
    }
  };

  const handleSend = async (text?: string) => {
    const msg = (text ?? inputContent).trim();
    if (!msg || isLoading) return;
    setInputContent("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendMessage(msg);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setInputContent(prompt);
    textareaRef.current?.focus();
  };

  const handleFinishOnboarding = async () => {
    if (!obResult) return;
    setObGeneratingProfile(true);
    try {
      const res = await fetch("/api/generate-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis: obResult }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof window !== "undefined") {
          window.localStorage.setItem("traveler_context", data.traveler);
          window.localStorage.setItem("trip_memory", data.trip_memory);
        }
      }
    } catch (e) {
      console.error("Profile generation failed", e);
    } finally {
      setObGeneratingProfile(false);
      setOnboardingComplete(true);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // ONBOARDING FLOW — shown before the chat
  // ══════════════════════════════════════════════════════════════════════════════
  if (!onboardingComplete) {
    if (obGeneratingProfile) {
      return <ProfileGenerationLoadingScreen />;
    }
    return (
      <>
        {/* ─── Step 0: Hero Login ─── */}
        {obStep === 0 && !obIsLoading && (
          <div className="hero-wrapper fade-in" style={{ position: "relative" }}>
            <InteractiveBackground />

            <header className="app-navbar">
              <span className="app-navbar-logo">LuftGo</span>
            </header>

            <div className="hero-section">
              <div className="hero-left">
                <h1 className="hero-title">
                  We predict the plan. <br /> You enjoy <br /> the{" "}
                  <span
                    className="serif-italic"
                    style={{
                      borderBottom: "3px solid var(--brand)",
                      paddingBottom: "2px",
                    }}
                  >
                    journey
                  </span>
                  .
                </h1>

                <p className="hero-subtitle">
                  We know how you move. Get hyper-personalized itineraries based
                  on your real travel history.
                </p>

                <div className="hero-login-box">
                  {!showUpload ? (
                    <>
                      <div className="email-input-wrapper" style={{ marginBottom: "1rem" }}>
                        <input
                          type="email"
                          placeholder="your.email@gmail.com"
                          value={obEmail}
                          onChange={(e) => setObEmail(e.target.value)}
                          onKeyDown={handleObKeyDown}
                          className="email-input"
                          style={{
                            padding: "1.25rem 1.5rem",
                            fontSize: "1.1rem",
                            borderRadius: "3rem",
                          }}
                          autoFocus
                        />
                      </div>

                      {obError && (
                        <div className="error-msg fade-in">⚠️ {obError}</div>
                      )}

                      <button
                        className="upload-btn"
                        onClick={handleObLogin}
                        disabled={!obEmail.trim()}
                        style={{ padding: "1.25rem", fontSize: "1.1rem" }}
                      >
                        Plan your trip
                      </button>

                      <div className="divider">
                        <span>or</span>
                      </div>

                      <button
                        className="secondary-btn"
                        onClick={() => setShowUpload(true)}
                      >
                        📂 Upload Timeline.json manually
                      </button>
                    </>
                  ) : (
                    <>
                      <label
                        className="file-drop-area"
                        htmlFor="file-input"
                        style={{ marginBottom: "1rem" }}
                      >
                        {selectedFile ? (
                          <div className="file-info">
                            <span>✅</span>
                            <span>
                              {selectedFile.name} (
                              {(selectedFile.size / 1e6).toFixed(1)} MB)
                            </span>
                          </div>
                        ) : (
                          <>
                            <span style={{ fontSize: "1.8rem" }}>📎</span>
                            <span
                              style={{
                                fontSize: "0.95rem",
                                color: "var(--muted-foreground)",
                              }}
                            >
                              Select <strong>Timeline.json</strong>
                            </span>
                          </>
                        )}
                        <input
                          id="file-input"
                          type="file"
                          accept=".json"
                          onChange={(e) =>
                            setSelectedFile(e.target.files?.[0] || null)
                          }
                          style={{ display: "none" }}
                        />
                      </label>

                      {obError && (
                        <div className="error-msg fade-in">⚠️ {obError}</div>
                      )}

                      <button
                        className="upload-btn"
                        onClick={handleObUpload}
                        disabled={!selectedFile}
                        style={{ padding: "1.25rem", fontSize: "1.1rem" }}
                      >
                        Analyze Travel History
                      </button>

                      <div className="divider">
                        <span>or</span>
                      </div>

                      <button
                        className="secondary-btn"
                        onClick={() => setShowUpload(false)}
                      >
                        ✉️ Sign in with Gmail instead
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column: Image Grid */}
              <div className="hero-right">
                <div className="hero-image-grid">
                  <div
                    className="hero-img-tall"
                    style={{
                      backgroundImage:
                        "url(https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&h=1200&fit=crop)",
                    }}
                  />
                  <div className="hero-img-stack">
                    <div
                      className="hero-img-small"
                      style={{
                        backgroundImage:
                          "url(https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&h=400&fit=crop)",
                      }}
                    />
                    <div
                      className="hero-img-small"
                      style={{
                        backgroundImage:
                          "url(https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&h=600&fit=crop)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Steps 1–5: Wizard ─── */}
        {(obIsLoading || obStep > 0) && (
          <div className="hero-wrapper" style={{ position: "relative" }}>
            <InteractiveBackground />

            <header className="app-navbar">
              <span className="app-navbar-logo">LuftGo</span>
            </header>

            <div
              className="wizard-container"
              style={{ position: "relative", zIndex: 1, flex: 1 }}
            >
              {obStep > 0 && obStep <= 5 && (
                <div className="wizard-top-bar fade-in">
                  <StepIndicator
                    currentStep={obStep}
                    totalSteps={6}
                    labels={STEP_LABELS}
                  />
                </div>
              )}

              {obIsLoading && <LoadingScreen step={obLoadingStep} />}

              {obStep === 1 && obResult && (
                <TravelDNAStep
                  profile={obResult.profile}
                  onNext={() => setObStep(2)}
                />
              )}

              {obStep === 2 && obResult && (
                <MovementStep
                  profile={obResult.profile}
                  onNext={() => setObStep(3)}
                  onBack={() => setObStep(1)}
                />
              )}

              {obStep === 3 && obResult && (
                <WorldStep
                  profile={obResult.profile}
                  flights={obResult.flights || []}
                  onNext={() => setObStep(4)}
                  onBack={() => setObStep(2)}
                />
              )}

              {obStep === 4 && obResult && (
                <StyleStep
                  profile={obResult.profile}
                  onUpdatePreferences={handleUpdatePreferences}
                  onNext={() => setObStep(5)}
                  onBack={() => setObStep(3)}
                />
              )}

              {obStep === 5 && obResult && (
                <SuggestionsStep
                  suggestions={obResult.suggestions}
                  email={obResult.email}
                  onBack={() => setObStep(4)}
                  onFinish={handleFinishOnboarding}
                />
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // CHAT UI — shown after onboarding is complete
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex font-sans h-screen bg-gray-50 text-gray-900">
      {/* ─── Left: Chat Panel ─── */}
      <div className="flex flex-col w-[45%] min-w-[380px] max-w-[540px] bg-white border-r border-gray-200 shadow-xl z-10 relative overflow-hidden">
        {/* Animated Background */}
        <InteractiveBackground />


        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight text-black">
              LuftGo
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarExport trip={trip} />
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="text-sm text-gray-500 hover:text-black transition-colors px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scroll-smooth relative z-10 chat-scroll">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 px-6 text-center">
              {/* Animated Figma Illustration */}
              <div className="w-40 h-40 relative mx-auto drop-shadow-sm">
                <motion.svg
                  width="160"
                  height="160"
                  viewBox="0 0 160 160"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  {/* Soft background glow / circle */}
                  <circle cx="80" cy="80" r="70" fill="#FFF8F9" />
                  <circle cx="80" cy="80" r="50" fill="#FCE8EC" />

                  {/* Globe Outline */}
                  <circle
                    cx="80"
                    cy="80"
                    r="40"
                    stroke="#FF385C"
                    strokeWidth="3"
                  />
                  <path
                    d="M80 40C95 40 105 58 105 80C105 102 95 120 80 120"
                    stroke="#FF385C"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M80 40C65 40 55 58 55 80C55 102 65 120 80 120"
                    stroke="#FF385C"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M40 80H120"
                    stroke="#FF385C"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M48 60H112"
                    stroke="#FF385C"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M48 100H112"
                    stroke="#FF385C"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />

                  {/* Paper Plane / Flight Path */}
                  <motion.path
                    d="M80 80C95 60 120 45 140 30"
                    stroke="#00A699"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="6 6"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, delay: 0.3 }}
                  />

                  {/* Airplane */}
                  <motion.g
                    initial={{ opacity: 0, x: -10, y: 10 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                  >
                    <path
                      d="M136.5 24.5C138.5 22.5 142.5 20.5 145 23C147.5 25.5 145.5 29.5 143.5 31.5L127 48L114 49L117 38L136.5 24.5Z"
                      fill="#FF385C"
                    />
                    <path d="M124 41L114 49L108 43L116 33Z" fill="#cc1c40" />
                  </motion.g>

                  {/* Location Pin */}
                  <motion.g
                    initial={{ scale: 0, y: -10 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", bounce: 0.5, delay: 1 }}
                  >
                    <path
                      d="M55 45C55 36.7157 61.7157 30 70 30C78.2843 30 85 36.7157 85 45C85 55 70 65 70 65C70 65 55 55 55 45Z"
                      fill="#FFB400"
                    />
                    <circle cx="70" cy="43" r="5" fill="#FFFFFF" />
                  </motion.g>

                  {/* Floating Clouds */}
                  <motion.g
                    animate={{ y: [0, -3, 0] }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <path
                      d="M45 105C45 102.239 47.2386 100 50 100H65C67.7614 100 70 102.239 70 105C70 107.761 67.7614 110 65 110H50C47.2386 110 45 107.761 45 105Z"
                      fill="#EBEBEB"
                    />
                    <circle cx="53" cy="101" r="6" fill="#EBEBEB" />
                    <circle cx="61" cy="102" r="5" fill="#EBEBEB" />
                  </motion.g>

                  <motion.g
                    animate={{ y: [0, 4, 0] }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1,
                    }}
                  >
                    <path
                      d="M100 115C100 113.343 101.343 112 103 112H117C118.657 112 120 113.343 120 115C120 116.657 118.657 118 117 118H103C101.343 118 100 116.657 100 115Z"
                      fill="#F7F7F7"
                    />
                    <circle cx="106" cy="112" r="4" fill="#F7F7F7" />
                    <circle cx="113" cy="113" r="3" fill="#F7F7F7" />
                  </motion.g>
                </motion.svg>
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                Plan your perfect trip
              </h1>
              <p className="text-base text-gray-500 max-w-xs">
                I can help you build an itinerary anywhere in the world. Just
                tell me where you want to go!
              </p>
            </div>
          ) : (
            <div className="pt-4 pb-6 px-2">
              {messages.map((msg, idx) => {
                const isLastMsg = idx === messages.length - 1;
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isStreaming={
                      isLoading &&
                      msg.role === "assistant" &&
                      isLastMsg
                    }
                    isLast={isLastMsg}
                  />
                );
              })}
              <div ref={bottomRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex justify-between items-center shrink-0">
            <span className="flex items-center gap-2">
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              {error}
            </span>
            <button
              onClick={clearError}
              className="ml-3 text-red-400 hover:text-red-700 p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input area */}
        <div className="px-5 pb-6 pt-2 shrink-0 bg-white">
          <SuggestionChips
            suggestions={activeSuggestions}
            onSuggestionClick={handleSuggestionClick}
          />

          {/* Input bar */}
          <div className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm focus-within:shadow-md focus-within:border-[#FF8FA3] transition-all p-3">
            <textarea
              ref={textareaRef}
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={() => {
                const el = textareaRef.current;
                if (!el) return;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 200) + "px";
              }}
              placeholder="Ask anything..."
              rows={1}
              disabled={isLoading}
              className="w-full resize-none bg-transparent text-[15px] text-gray-900 placeholder-gray-400 outline-none leading-relaxed pb-3 px-1"
            />
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1">
                {/* Attachment icon */}
                <button className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
                {/* Calendar icon */}
                <button className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => handleSend()}
                disabled={!inputContent.trim() || isLoading}
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                  inputContent.trim() && !isLoading
                    ? "bg-black text-white hover:bg-gray-800"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* ─── Right: Map/Destinations Panel ─── */}
      <div className="flex-1 relative bg-gray-100">
        <TripMap trip={trip} />
      </div>
    </div>
  );
}
