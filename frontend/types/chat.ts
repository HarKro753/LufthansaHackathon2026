export interface StreamEvent {
  type:
    | "status"
    | "content"
    | "done"
    | "error"
    | "tool_call_start"
    | "tool_call_complete"
    | "tool_call_error"
    | "tool_call_args"
    | "thinking"
    | "suggestions";
  status?: string;
  content?: string;
  error?: string;
  toolCall?: { id: string; name: string; arguments: Record<string, unknown> };
  toolCallId?: string;
  result?: string;
  arguments?: Record<string, unknown>;
  /** Trip item ID — present on tool_call_complete for trip-mutating tools */
  itemId?: string;
  /** Trip item type — present on tool_call_complete for trip-mutating tools */
  itemType?: string;
  suggestions?: Suggestion[];
}

export interface Suggestion {
  short_text: string;
  prompt_text: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "pending" | "executing" | "completed" | "error";
  result?: string;
  error?: string;
}

export interface ThinkingStep {
  id: string;
  content: string;
}

export interface ContentBlock {
  id: string;
  content: string;
}

export type TimelineItemType = "flight" | "stay" | "route" | "activity";

export type TimelineItem =
  | { itemType: "flight"; data: import("@/types/trip").TripFlight }
  | { itemType: "stay"; data: import("@/types/trip").TripStay }
  | { itemType: "route"; data: import("@/types/trip").TripRoute }
  | { itemType: "activity"; data: import("@/types/trip").TripActivity };

export type ActivityItem =
  | { type: "tool_call"; data: ToolCall }
  | { type: "thinking"; data: ThinkingStep }
  | { type: "content"; data: ContentBlock }
  | { type: "timeline"; data: TimelineItem };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  activities?: ActivityItem[];
}
