// src/components/chat/ChatMessage.tsx
// Shared message component used by both ChatInterface (RAG) and AgentChat

import React, { memo, useState } from "react";
import { Avatar, AvatarFallback } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import {
  Brain,
  Wrench,
  User,
  ThumbsUp,
  ThumbsDown,
  FileText,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/utils/misc";
import ReactMarkdown from "react-markdown";
import {
  markdownComponents,
  fixOrderedListNumbering,
} from "@/components/chat/markdown";

// --- Types ---

export interface Citation {
  chunkId: string;
  documentName: string;
  content: string;
  pageNumber?: number;
  parser?: string;
}

export interface ChatMessageData {
  id: string;
  role: string;
  content?: string;
  parts?: { type: string; content?: string; name?: string }[];
}

// --- Sub-components ---

const MessagePart = memo(
  ({ part }: { part: { type: string; content?: string; name?: string } }) => {
    switch (part.type) {
      case "thinking":
        return (
          <div className="flex items-start gap-2 mt-2">
            <Brain className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-sm italic text-muted-foreground">
              {part.content}
            </p>
          </div>
        );
      case "tool-call":
        return (
          <div className="flex items-center gap-2 mt-2">
            <Wrench className="h-4 w-4 text-blue-500 mt-0.5" />
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              Calling: {part.name || "Tool"}
            </Badge>
          </div>
        );
      case "tool-result":
        return (
          <div className="flex items-center gap-2 mt-2">
            <Badge
              variant="default"
              className="bg-green-100 text-green-800 border-green-200"
            >
              Tool result
            </Badge>
          </div>
        );
      default:
        return null;
    }
  },
);
MessagePart.displayName = "MessagePart";

const Citations = memo(({ citations }: { citations: Citation[] }) => {
  const [expanded, setExpanded] = useState(false);
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <FileText className="h-3 w-3" />
        <span>Sources ({citations.length})</span>
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform",
            expanded && "rotate-90",
          )}
        />
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {citations.map((citation, idx) => (
            <div
              key={idx}
              className="text-xs p-2 rounded bg-secondary/50 border border-border"
            >
              <p className="font-medium text-foreground mb-1">
                {idx + 1}. {citation.documentName}
                {citation.pageNumber && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    (p.{citation.pageNumber})
                  </span>
                )}
                {citation.parser && (
                  <Badge variant="outline" className="ml-2 text-[10px] py-0">
                    {citation.parser === "docling" ? "Docling" : "LlamaParse"}
                  </Badge>
                )}
              </p>
              <p className="text-muted-foreground line-clamp-2">
                {citation.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
Citations.displayName = "Citations";

const MessageFeedback = memo(
  ({
    messageId,
    onFeedback,
    existingFeedback,
  }: {
    messageId: string;
    onFeedback: (messageId: string, rating: "positive" | "negative") => void;
    existingFeedback?: { rating: "positive" | "negative" } | null;
  }) => (
    <div className="flex items-center gap-1 mt-2">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6",
          existingFeedback?.rating === "positive" &&
            "text-green-600 bg-green-100",
        )}
        onClick={() => onFeedback(messageId, "positive")}
      >
        <ThumbsUp className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6",
          existingFeedback?.rating === "negative" && "text-red-600 bg-red-100",
        )}
        onClick={() => onFeedback(messageId, "negative")}
      >
        <ThumbsDown className="h-3 w-3" />
      </Button>
    </div>
  ),
);
MessageFeedback.displayName = "MessageFeedback";

// --- Main ChatMessage component ---

export const ChatMessage = memo(
  ({
    message,
    onFeedback,
    existingFeedback,
    citations,
    isStreaming,
  }: {
    message: ChatMessageData;
    onFeedback?: (messageId: string, rating: "positive" | "negative") => void;
    existingFeedback?: { rating: "positive" | "negative" } | null;
    citations?: Citation[];
    isStreaming?: boolean;
  }) => {
    // --- User message: bubble layout ---
    if (message.role === "user") {
      const userText =
        message.parts?.find((p) => p.type === "text")?.content ??
        message.content ??
        "";
      return (
        <div className="flex gap-3 flex-row-reverse">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-right">
            <div className="flex items-center gap-2 mb-1 justify-end">
              <span className="text-xs font-medium text-muted-foreground">
                You
              </span>
            </div>
            <div className="inline-block rounded-lg px-4 py-3 max-w-[85%] bg-primary text-primary-foreground ml-auto">
              <p className="text-base leading-relaxed break-words whitespace-pre-wrap">
                {userText}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // --- Assistant / agent message: document-style layout ---
    const textContent = message.parts
      ? message.parts
          .filter((p) => p.type === "text")
          .map((p) => p.content ?? "")
          .join("\n\n")
      : (message.content ?? "");
    const nonTextParts = message.parts?.filter((p) => p.type !== "text") ?? [];

    return (
      <div className="border-t border-border/40 pt-4">
        {nonTextParts.map((part, idx) => (
          <MessagePart key={idx} part={part} />
        ))}

        {textContent && (
          <ReactMarkdown components={markdownComponents}>
            {fixOrderedListNumbering(textContent)}
          </ReactMarkdown>
        )}

        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-foreground/40 animate-pulse rounded-full" />
        )}

        {citations && <Citations citations={citations} />}

        {onFeedback && !message.id.startsWith("msg_") && (
          <MessageFeedback
            messageId={message.id}
            onFeedback={onFeedback}
            existingFeedback={existingFeedback}
          />
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.isStreaming === nextProps.isStreaming &&
      JSON.stringify(prevProps.message.parts) ===
        JSON.stringify(nextProps.message.parts) &&
      prevProps.existingFeedback?.rating === nextProps.existingFeedback?.rating
    );
  },
);
ChatMessage.displayName = "ChatMessage";
