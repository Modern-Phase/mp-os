import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
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
  Loader2,
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
  MoreVertical,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/utils/misc";
import { useConvexAuthToken } from "@/utils/auth";
import {
  ChatMessage,
  type Citation,
  type ChatMessageData,
} from "@/components/chat/ChatMessage";

// Chat session type
interface ChatSession {
  _id: Id<"chatSessions">;
  userId: Id<"users">;
  title: string;
  collectionIds: Id<"documentCollections">[];
  lastMessageAt: number;
}

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
      return message.citationMeta
        .slice(0, 5)
        .map((meta: any, index: number) => ({
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
    <div className="flex h-screen w-screen bg-background overflow-hidden">
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
        <main className="flex-1 min-h-0 overflow-hidden relative">
          <ScrollArea ref={scrollAreaRef} className="h-full px-4 sm:px-6">
            <div className="max-w-3xl mx-auto space-y-6 py-6 pb-20 min-h-full">
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
