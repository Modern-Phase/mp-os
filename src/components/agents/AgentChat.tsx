// src/components/agents/AgentChat.tsx
// In-app chat interface for talking to agents
// Reuses shared ChatMessage + markdown components from /chat

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import { Avatar, AvatarFallback } from "@/ui/avatar";
import { Textarea } from "@/ui/textarea";
import { Badge } from "@/ui/badge";
import { Send, Loader2, RotateCcw, ChevronDown, ListChecks } from "lucide-react";
import { ChatMessage } from "@/components/chat/ChatMessage";
import type { Citation } from "@/components/chat/ChatMessage";

interface AgentChatProps {
  agent: any;
  orgId: Id<"organizations">;
}

export function AgentChat({ agent, orgId }: AgentChatProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useQuery(api.agentChat.getAgentChatHistory, {
    orgId,
    agentId: agent.agentId,
    limit: 50,
  });

  const createChatMessage = useMutation(api.agentChat.createChatMessage);
  const getOrCreateSession = useMutation(api.agentChat.getOrCreateSession);

  // Only show "thinking" for actively streaming or recent pending (last msg, < 2 min)
  const isAgentResponding = (() => {
    if (!messages || messages.length === 0) return false;
    if (messages.some((msg: any) => msg.status === "streaming")) return true;
    const last = messages[messages.length - 1];
    return (
      last.role === "user" &&
      last.status === "pending" &&
      Date.now() - last.timestamp < 120_000
    );
  })();

  // Auto-scroll when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  // Track scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      setIsAtBottom(atBottom);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  }, []);

  const handleSend = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!message.trim() || sending) return;

      const content = message.trim();
      setMessage("");
      setSending(true);
      try {
        const sessionId = await getOrCreateSession({
          orgId,
          agentId: agent.agentId,
        });
        await createChatMessage({
          orgId,
          agentId: agent.agentId,
          content,
          role: "user",
          sessionId: sessionId || undefined,
        });
      } catch (err) {
        setMessage(content);
        console.error("[AgentChat] Failed to send:", err);
      } finally {
        setSending(false);
      }
    },
    [message, sending, orgId, agent.agentId, createChatMessage, getOrCreateSession],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRetry = async (failedMsg: any) => {
    setSending(true);
    try {
      const sessionId = await getOrCreateSession({
        orgId,
        agentId: agent.agentId,
      });
      await createChatMessage({
        orgId,
        agentId: agent.agentId,
        content: failedMsg.content,
        role: "user",
        sessionId: sessionId || undefined,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback
              style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
              className="text-base"
            >
              {agent.emoji}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-foreground">{agent.name}</h2>
            <p className="text-xs text-muted-foreground">{agent.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAgentResponding ? (
            <>
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                style={{ color: agent.color }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: agent.color }}
              >
                Thinking...
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">Online</span>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <main className="flex-1 min-h-0 overflow-hidden relative">
        <div ref={scrollRef} className="h-full overflow-y-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto space-y-6 py-6 pb-20 min-h-full">
            {/* Welcome */}
            {(!messages || messages.length === 0) && (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <Avatar className="h-16 w-16 mx-auto mb-4">
                  <AvatarFallback
                    style={{
                      backgroundColor: `${agent.color}15`,
                      color: agent.color,
                    }}
                    className="text-3xl"
                  >
                    {agent.emoji}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Chat with {agent.name}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {agent.role}. I can help with:{" "}
                  {agent.expertise?.join(", ") || "various tasks"}.
                </p>
              </div>
            )}

            {/* Render messages using shared ChatMessage component */}
            {messages?.map((msg: any) => {
              const isStreaming = msg.status === "streaming";
              const isFailed =
                msg.role === "user" &&
                msg.status === "pending" &&
                Date.now() - msg.timestamp > 120_000;

              // Build citations for agent messages from the user message they replied to
              let citations: Citation[] | undefined;
              if (msg.role === "agent" && msg.replyTo) {
                const userMsg = messages?.find((m: any) => m._id === msg.replyTo);
                if (userMsg?.citationMeta && userMsg.citationMeta.length > 0) {
                  citations = userMsg.citationMeta.map((c: any, idx: number) => ({
                    chunkId: userMsg.retrievedChunks?.[idx] || `chunk-${idx}`,
                    documentName: c.documentName,
                    content: c.content,
                    pageNumber: c.pageNumber,
                    parser: c.parser,
                  }));
                }
              }

              return (
                <div key={msg._id}>
                  <ChatMessage
                    message={{
                      id: msg._id,
                      role: msg.role,
                      content: msg.content,
                    }}
                    isStreaming={isStreaming && msg.role !== "user"}
                    citations={citations}
                  />
                  {/* Task creation badge */}
                  {msg.processedTaskDirectives > 0 && (
                    <div className="mt-2">
                      <Badge variant="secondary" className="gap-1.5 text-xs">
                        <ListChecks className="h-3 w-3" />
                        {msg.processedTaskDirectives} task{msg.processedTaskDirectives > 1 ? "s" : ""} created
                      </Badge>
                    </div>
                  )}
                  {isFailed && (
                    <div className="flex justify-end mt-1">
                      <button
                        onClick={() => handleRetry(msg)}
                        className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-400 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading indicator when waiting for response */}
            {isAgentResponding &&
              !messages?.some((m: any) => m.status === "streaming") && (
                <div className="border-t border-border/40 pt-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-base text-muted-foreground">
                      Thinking...
                    </span>
                  </div>
                </div>
              )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Scroll to bottom button */}
        {!isAtBottom && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center z-10">
            <button
              onClick={scrollToBottom}
              className="flex items-center gap-1.5 rounded-full border border-border bg-background/90 backdrop-blur-sm shadow-md px-3.5 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Scroll to bottom
            </button>
          </div>
        )}
      </main>

      {/* Input Area — same style as ChatInterface */}
      <div className="flex-shrink-0 border-t p-4 bg-background/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSend} className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${agent.name}...`}
              className="flex-1 min-h-[80px] max-h-48"
              disabled={sending}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!message.trim() || sending}
              className="shrink-0"
            >
              {sending ? (
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
  );
}
