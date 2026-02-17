import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  useMemo,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import { Id } from "@cvx/_generated/dataModel";
import { Button } from "@/ui/button";
import { Textarea } from "@/ui/textarea";
import { Avatar, AvatarFallback } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { ScrollArea } from "@/ui/scroll-area";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/ui/dialog";
import { Input } from "@/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import {
  Send,
  Bot,
  User,
  Loader2,
  Brain,
  Wrench,
  Menu,
  X,
  LayoutDashboard,
  MessageSquare,
  Settings,
  AlertCircle,
  Plus,
  Trash2,
  Folder,
  Check,
  ThumbsUp,
  ThumbsDown,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  FileText,
} from "lucide-react";
import { cn } from "@/utils/misc";
import { useConvexAuthToken } from "@/utils/auth";
import ReactMarkdown from "react-markdown";

// Chat session type
interface ChatSession {
  _id: Id<"chatSessions">;
  userId: Id<"users">;
  title: string;
  collectionIds: Id<"documentCollections">[];
  lastMessageAt: number;
}

// Message with citations
interface Citation {
  chunkId: Id<"documentChunks"> | string;
  documentName: string;
  content: string;
  pageNumber?: number;
  parser?: string;
}

// Message part renderer
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
              ✓ Tool result
            </Badge>
          </div>
        );
      default:
        return null;
    }
  },
);
MessagePart.displayName = "MessagePart";

// Citations component
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
                  <span className="text-muted-foreground font-normal"> (p.{citation.pageNumber})</span>
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

// Feedback buttons component
const MessageFeedback = memo(
  ({
    messageId,
    onFeedback,
    existingFeedback,
  }: {
    messageId: string;
    onFeedback: (messageId: string, rating: "positive" | "negative") => void;
    existingFeedback?: { rating: "positive" | "negative" } | null;
  }) => {
    return (
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
            existingFeedback?.rating === "negative" &&
              "text-red-600 bg-red-100",
          )}
          onClick={() => onFeedback(messageId, "negative")}
        >
          <ThumbsDown className="h-3 w-3" />
        </Button>
      </div>
    );
  },
);
MessageFeedback.displayName = "MessageFeedback";

// Extract plain text from React nodes (used for section-header detection in paragraphs)
function getTextContent(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (React.isValidElement(node) && node.props?.children) {
    return getTextContent(node.props.children);
  }
  return "";
}

// Renumber ordered list items sequentially — AI often emits all items as "1." which
// is valid markdown but causes each to land in its own <ol> starting at 1 when
// blank lines or sub-lists sit between them. Counter resets on headings or
// non-list paragraphs, so genuinely separate lists stay independent.
function fixOrderedListNumbering(text: string): string {
  let counter = 0;
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) {
      counter = 0;
    } else if (/^\d+\.\s/.test(lines[i])) {
      counter++;
      lines[i] = lines[i].replace(/^\d+\./, `${counter}.`);
    } else if (
      lines[i].trim() !== "" &&
      !/^[-*+]\s/.test(lines[i].trim()) &&
      !/^\s/.test(lines[i])
    ) {
      // Non-empty, non-list, non-indented line (a real paragraph) — reset
      counter = 0;
    }
  }

  return lines.join("\n");
}

// Markdown rendering config for assistant messages — defined outside to avoid re-creation on each render
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-2xl font-bold mt-6 mb-3 text-foreground">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-xl font-bold mt-6 mb-3 text-foreground">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-lg font-bold mt-5 mb-2 text-foreground">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => {
    const text = getTextContent(children).trim();
    const isSectionHeader =
      text.endsWith(":") && text.length > 5 && text.length < 100;
    return isSectionHeader ? (
      <p className="text-lg font-bold text-foreground mt-6 mb-2 pb-2 border-b border-border/30">
        {children}
      </p>
    ) : (
      <p className="text-base leading-relaxed mb-3 text-foreground">
        {children}
      </p>
    );
  },
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-5 space-y-2 my-3">{children}</ul>
  ),
  ol: ({ children, start }: { children?: React.ReactNode; start?: number }) => (
    <ol className="list-decimal pl-5 space-y-2 my-3" start={start}>
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-base leading-relaxed text-foreground">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => {
    const isSafe = !href || /^(https?:\/\/|mailto:|\/|#|\.)/.test(href);
    if (!isSafe) return <span className="text-primary">{children}</span>;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {children}
      </a>
    );
  },
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-primary/50 bg-muted/30 pl-4 pr-3 py-2 my-3 rounded-r-md text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-border" />,
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-muted rounded-lg p-3 overflow-x-auto my-3 text-sm">
      {children}
    </pre>
  ),
  code: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) =>
    className ? (
      <code className={`${className} text-sm`}>{children}</code>
    ) : (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{children}</code>
    ),
};

// Individual message component
const ChatMessage = memo(
  ({
    message,
    onFeedback,
    existingFeedback,
    citations,
  }: {
    message: {
      id: string;
      role: string;
      content?: string;
      parts?: { type: string; content?: string; name?: string }[];
    };
    onFeedback?: (messageId: string, rating: "positive" | "negative") => void;
    existingFeedback?: { rating: "positive" | "negative" } | null;
    citations?: Citation[];
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
            <AvatarFallback className="bg-blue-100 text-blue-600">
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

    // --- Assistant message: document-style layout ---
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
      JSON.stringify(prevProps.message.parts) ===
        JSON.stringify(nextProps.message.parts) &&
      prevProps.existingFeedback?.rating === nextProps.existingFeedback?.rating
    );
  },
);
ChatMessage.displayName = "ChatMessage";

export function ChatInterface() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [isSessionSidebarOpen, setIsSessionSidebarOpen] = useState(true);
  const [selectedSessionId, setSelectedSessionId] =
    useState<Id<"chatSessions"> | null>(null);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<
    Id<"documentCollections">[]
  >([]);
  const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef(false);
  const sessionIdForRequestRef = useRef<Id<"chatSessions"> | null>(null);
  const lastHydratedSessionIdRef = useRef<Id<"chatSessions"> | null>(null);
  const hasDefaultedToCollectionRef = useRef(false);
  const selectedCollectionIdsRef = useRef<Id<"documentCollections">[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    selectedCollectionIdsRef.current = selectedCollectionIds;
  }, [selectedCollectionIds]);

  const getConvexToken = useConvexAuthToken();

  // Queries
  const { data: sessions, isLoading: sessionsLoading } = useQuery(
    convexQuery(api.chat.listSessions, {}),
  );

  const { data: collections, isLoading: collectionsLoading } = useQuery(
    convexQuery(api.collections.listCollections, {}),
  );

  const { data: currentSession } = useQuery(
    convexQuery(
      api.chat.getSession,
      selectedSessionId ? { sessionId: selectedSessionId } : "skip",
    ),
  );

  const { data: sessionFeedback } = useQuery(
    convexQuery(
      api.chat.getFeedbackForSession,
      selectedSessionId ? { sessionId: selectedSessionId } : "skip",
    ),
  );
  const feedbackByMessageId = useMemo(() => {
    const map = new Map<string, { rating: "positive" | "negative" }>();
    sessionFeedback?.forEach((f) => {
      map.set(f.messageId, { rating: f.rating });
    });
    return map;
  }, [sessionFeedback]);

  // Helper function to get citations for a message
  const getCitationsForMessage = useCallback((message: any): Citation[] => {
    // Use real citation metadata when available
    if (message.citationMeta && message.citationMeta.length > 0) {
      return message.citationMeta.slice(0, 5).map((meta: any, index: number) => ({
        chunkId: message.retrievedChunks?.[index] || `citation_${index}`,
        documentName: meta.documentName,
        content: meta.content,
        pageNumber: meta.pageNumber,
        parser: meta.parser,
      }));
    }

    // Fallback for old messages without citationMeta
    if (!message.retrievedChunks || message.retrievedChunks.length === 0) {
      return [];
    }
    return message.retrievedChunks
      .slice(0, 5)
      .map((chunkId: Id<"documentChunks">, index: number) => ({
        chunkId,
        documentName: `Document ${index + 1}`,
        content: `Source ${index + 1} content...`,
      }));
  }, []);

  // Default to all collections for new chats so RAG uses every uploaded doc without extra steps
  useEffect(() => {
    console.log("[ChatInterface] Collection auto-select effect", {
      selectedSessionId,
      collectionsLength: collections?.length,
      selectedCollectionIdsLength: selectedCollectionIds.length,
      hasDefaulted: hasDefaultedToCollectionRef.current,
    });

    if (selectedSessionId != null) {
      hasDefaultedToCollectionRef.current = false;
      return;
    }
    if (
      !collections?.length ||
      selectedCollectionIds.length > 0 ||
      hasDefaultedToCollectionRef.current
    )
      return;

    console.log(
      "[ChatInterface] Auto-selecting all collections:",
      collections.map((c) => c._id),
    );
    setSelectedCollectionIds(collections.map((c) => c._id));
    hasDefaultedToCollectionRef.current = true;
  }, [collections, selectedCollectionIds.length, selectedSessionId]);

  // Mutations
  const createSession = useMutation({
    mutationFn: useConvexMutation(api.chat.createSession),
    onSuccess: (sessionId: Id<"chatSessions">) => {
      queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
      setSelectedSessionId(sessionId);
      setIsNewSessionDialogOpen(false);
      setNewSessionTitle("");
    },
  });

  const deleteSession = useMutation({
    mutationFn: useConvexMutation(api.chat.deleteSession),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
      if (selectedSessionId) {
        setSelectedSessionId(null);
      }
    },
  });

  const rateMessage = useMutation({
    mutationFn: useConvexMutation(api.chat.rateMessage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatMessages"] });
    },
  });

  // Get Convex site URL for HTTP endpoints
  const convexUrl = import.meta.env.VITE_CONVEX_URL || "";
  const convexSiteUrl =
    import.meta.env.VITE_CONVEX_SITE_URL ||
    convexUrl.replace(".cloud", ".site");
  const chatEndpoint = `${convexSiteUrl}/api/chat`;

  const { messages, sendMessage, isLoading, error, setMessages } = useChat({
    connection: fetchServerSentEvents(chatEndpoint, async () => {
      const token = await getConvexToken();
      const sessionId = sessionIdForRequestRef.current ?? selectedSessionId;
      if (sessionIdForRequestRef.current) {
        sessionIdForRequestRef.current = null;
      }
      // Use ref to get the latest collectionIds (avoid closure issue)
      const currentCollectionIds = selectedCollectionIdsRef.current;
      console.log(
        "[ChatInterface] Sending message with collectionIds:",
        currentCollectionIds,
      );
      return {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: {
          sessionId,
          collectionIds: currentCollectionIds,
        },
      };
    }),
    onFinish: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "convexQuery" &&
          (query.queryKey[1] === api.chat.listSessions ||
            query.queryKey[1] === api.chat.getSession ||
            query.queryKey[1] === api.chat.getFeedbackForSession),
      });
    },
  });

  // Load persisted messages and collection IDs when user switches session (hydrate only once per selection so we don't overwrite in-flight messages)
  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      lastHydratedSessionIdRef.current = null;
      return;
    }
    if (
      !currentSession ||
      currentSession.session._id !== selectedSessionId ||
      lastHydratedSessionIdRef.current === selectedSessionId
    )
      return;
    // Don't overwrite with empty messages while user is sending (would wipe optimistic message)
    const { session, messages: sessionMessages } = currentSession;
    if (sessionMessages.length === 0 && isLoading) return;

    lastHydratedSessionIdRef.current = selectedSessionId;
    const uiMessages = sessionMessages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        id: m._id,
        role: m.role,
        parts: [{ type: "text" as const, content: m.content }],
      }));
    setMessages(uiMessages);
    shouldScrollToBottomRef.current = true;

    console.log(
      "[ChatInterface] Restoring session collectionIds:",
      session.collectionIds,
    );
    // If session has no collections but collections exist, default to all collections
    if (!session.collectionIds || session.collectionIds.length === 0) {
      if (collections && collections.length > 0) {
        console.log(
          "[ChatInterface] Session has no collections, defaulting to all",
        );
        setSelectedCollectionIds(collections.map((c) => c._id));
      } else {
        setSelectedCollectionIds([]);
      }
    } else {
      setSelectedCollectionIds(session.collectionIds);
    }
  }, [
    selectedSessionId,
    currentSession?.session?._id,
    setMessages,
    isLoading,
    collections,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    if (!selectedSessionId) {
      try {
        const newSessionId = await createSession.mutateAsync({
          title: input.slice(0, 50),
          collectionIds: selectedCollectionIds,
        });
        sessionIdForRequestRef.current = newSessionId;
        setSelectedSessionId(newSessionId);
      } catch {
        return;
      }
    }
    shouldScrollToBottomRef.current = true;
    sendMessage(input);
    setInput("");
  };

  const handleFeedback = (
    messageId: string,
    rating: "positive" | "negative",
  ) => {
    rateMessage.mutate({
      messageId: messageId as Id<"chatMessages">,
      rating,
    });
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
    setIsAtBottom(true);
  }, []);

  // Scroll to bottom only when explicitly requested (send or session restore),
  // never automatically on streaming updates.
  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      shouldScrollToBottomRef.current = false;
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages, scrollToBottom]);

  // Disable browser scroll-anchor (stops it from auto-pinning to the bottom
  // when streaming content grows) and track position for the scroll button.
  useEffect(() => {
    const viewport = scrollAreaRef.current;
    if (!viewport) return;

    viewport.style.overflowAnchor = "none";

    const handleScroll = () => {
      const threshold = 150;
      const atBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
        threshold;
      setIsAtBottom(atBottom);
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Session Sidebar */}
      <div
        className={cn(
          "relative flex-shrink-0 transition-all duration-300 ease-in-out border-r border-border bg-card",
          isSessionSidebarOpen ? "w-64" : "w-0",
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-64 flex flex-col",
            !isSessionSidebarOpen && "opacity-0 pointer-events-none",
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Chat History</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSessionSidebarOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setIsNewSessionDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </div>

          <ScrollArea className="flex-1 px-3">
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : sessions?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p className="text-sm">No chats yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {sessions?.map((session: ChatSession) => (
                  <div
                    key={session._id}
                    className={cn(
                      "flex items-center justify-between rounded-lg p-2 cursor-pointer transition-colors",
                      selectedSessionId === session._id
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-accent",
                    )}
                    onClick={() => setSelectedSessionId(session._id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {session.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.lastMessageAt).toLocaleDateString()}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this chat?")) {
                              deleteSession.mutate({ sessionId: session._id });
                            }
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Collection Selector */}
          <div className="border-t border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">
                Knowledge Base
              </p>
              {collections &&
                collections.length > 0 &&
                selectedCollectionIds.length === 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() =>
                      setSelectedCollectionIds(collections.map((c) => c._id))
                    }
                  >
                    Select All
                  </Button>
                )}
            </div>
            {collectionsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : collections && collections.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">
                <p>No collections yet.</p>
                <Link
                  to="/dashboard/documents"
                  className="text-primary hover:underline"
                >
                  Upload documents →
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {collections?.map((collection) => (
                  <button
                    key={collection._id}
                    onClick={() => {
                      if (selectedCollectionIds.includes(collection._id)) {
                        setSelectedCollectionIds(
                          selectedCollectionIds.filter(
                            (id) => id !== collection._id,
                          ),
                        );
                      } else {
                        setSelectedCollectionIds([
                          ...selectedCollectionIds,
                          collection._id,
                        ]);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs transition-colors",
                      selectedCollectionIds.includes(collection._id)
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent text-muted-foreground",
                    )}
                  >
                    {selectedCollectionIds.includes(collection._id) ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Folder className="h-3 w-3" />
                    )}
                    <span className="truncate">{collection.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {!isSessionSidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSessionSidebarOpen(true)}
                className="h-8 w-8"
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <h1 className="font-semibold">
              {currentSession?.session?.title || "New Chat"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedCollectionIds.length > 0 && (
              <Badge variant="secondary">
                {selectedCollectionIds.length} collection
                {selectedCollectionIds.length !== 1 ? "s" : ""} selected
              </Badge>
            )}
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Message Container */}
        <main className="flex-1 overflow-hidden relative">
          <ScrollArea ref={scrollAreaRef} className="h-full px-4 sm:px-6">
            <div
              className="max-w-3xl mx-auto space-y-6 py-6"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12">
                  <div className="mb-4">
                    <Avatar className="h-16 w-16 mx-auto">
                      <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                        <Bot className="h-8 w-8" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Welcome to AI Chat
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    {selectedCollectionIds.length > 0
                      ? `I'm ready to help using ${selectedCollectionIds.length} document collection${selectedCollectionIds.length !== 1 ? "s" : ""}. What would you like to know?`
                      : "Ask me anything! Select document collections on the left to enable RAG-based answers with your uploaded documents."}
                  </p>
                  {collections &&
                    collections.length > 0 &&
                    selectedCollectionIds.length === 0 && (
                      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <p className="text-xs text-yellow-700 dark:text-yellow-400">
                          ⚠️ You have {collections.length} collection
                          {collections.length !== 1 ? "s" : ""} but none are
                          selected. Select them in the sidebar to search your
                          documents.
                        </p>
                      </div>
                    )}
                </div>
              ) : (
                messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    onFeedback={handleFeedback}
                    existingFeedback={
                      message.role === "assistant"
                        ? (feedbackByMessageId.get(message.id) ?? null)
                        : undefined
                    }
                    citations={
                      message.role === "assistant"
                        ? getCitationsForMessage(message)
                        : undefined
                    }
                  />
                ))
              )}

              {isLoading && (
                <div className="border-t border-border/40 pt-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-base text-muted-foreground">
                      Thinking...
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="border-t border-border/40 pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">
                      Something went wrong
                    </span>
                  </div>
                  <p className="text-base text-foreground">
                    We couldn't get a response. Please check your connection and
                    try again.
                  </p>
                  {error.message && (
                    <p className="text-xs text-muted-foreground mt-1 break-words">
                      {error.message}
                    </p>
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </main>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t p-4 bg-background/50 backdrop-blur-sm relative">
          {!isAtBottom && (
            <div className="absolute -top-11 left-0 right-0 flex justify-center z-10">
              <button
                onClick={scrollToBottom}
                className="flex items-center gap-1.5 rounded-full border border-border bg-background/90 backdrop-blur-sm shadow-md px-3.5 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Scroll to bottom
              </button>
            </div>
          )}
          <div className="max-w-3xl mx-auto">
            {selectedCollectionIds.length > 0 && (
              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <span>Using collections:</span>
                {selectedCollectionIds.map((id) => {
                  const collection = collections?.find((c) => c._id === id);
                  return (
                    <Badge key={id} variant="outline" className="text-xs">
                      {collection?.name || "Unknown"}
                    </Badge>
                  );
                })}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setInput(e.target.value)
                }
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1 min-h-[80px] max-h-48"
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                size="icon"
                className="shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="sr-only">Send message</span>
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* New Session Dialog */}
      <Dialog
        open={isNewSessionDialogOpen}
        onOpenChange={setIsNewSessionDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Chat</DialogTitle>
            <DialogDescription>
              Start a new conversation. You can select document collections to
              enable RAG.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title (optional)</label>
              <Input
                placeholder="Chat title"
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Document Collections
              </label>
              <div className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">
                {collections?.map((collection) => (
                  <button
                    key={collection._id}
                    onClick={() => {
                      if (selectedCollectionIds.includes(collection._id)) {
                        setSelectedCollectionIds(
                          selectedCollectionIds.filter(
                            (id) => id !== collection._id,
                          ),
                        );
                      } else {
                        setSelectedCollectionIds([
                          ...selectedCollectionIds,
                          collection._id,
                        ]);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm transition-colors",
                      selectedCollectionIds.includes(collection._id)
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent",
                    )}
                  >
                    {selectedCollectionIds.includes(collection._id) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Folder className="h-4 w-4" />
                    )}
                    {collection.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNewSessionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                createSession.mutate({
                  title: newSessionTitle || undefined,
                  collectionIds: selectedCollectionIds,
                });
              }}
              disabled={createSession.isPending}
            >
              {createSession.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Start Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
