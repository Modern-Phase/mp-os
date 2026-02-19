// src/components/agents/AgentChat.tsx
// In-app chat interface for talking to agents

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Textarea } from "@/ui/textarea";
import { Send, User, Loader2, AlertCircle, RotateCcw } from "lucide-react";

interface AgentChatProps {
  agent: any;
  orgId: Id<"organizations">;
}

export function AgentChat({ agent, orgId }: AgentChatProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get chat history (reactive via Convex — streams in real-time)
  const messages = useQuery(api.agentChat.getAgentChatHistory, {
    orgId,
    agentId: agent.agentId,
    limit: 50,
  });

  // Mutations
  const createChatMessage = useMutation(api.agentChat.createChatMessage);
  const getOrCreateSession = useMutation(api.agentChat.getOrCreateSession);

  // Derive whether the agent is currently responding
  const isAgentResponding =
    messages?.some(
      (msg: any) => msg.status === "streaming" || msg.status === "pending",
    ) ?? false;

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
        // Restore message on failure so user doesn't lose their input
        setMessage(content);
        console.error("[AgentChat] Failed to send:", err);
      } finally {
        setSending(false);
      }
    },
    [
      message,
      sending,
      orgId,
      agent.agentId,
      createChatMessage,
      getOrCreateSession,
    ],
  );

  // Handle Enter to send, Shift+Enter for newline
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
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b pb-4 flex-shrink-0">
        <CardTitle className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{ backgroundColor: `${agent.color}20` }}
          >
            {agent.emoji}
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: agent.color }}>
              {agent.name}
            </h3>
            <p className="text-xs text-muted-foreground">{agent.role}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isAgentResponding ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                <span className="text-xs text-blue-500">Thinking...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">Online</span>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 scrollbar-thin"
        >
          <div className="space-y-4">
            {/* Welcome message */}
            <div className="flex gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: `${agent.color}20` }}
              >
                {agent.emoji}
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-w-[80%]">
                <p className="text-sm">
                  Hi! I'm {agent.name}, your {agent.role.toLowerCase()}. I can
                  help with: {agent.expertise.join(", ")}. What do you need?
                </p>
              </div>
            </div>

            {/* Chat messages */}
            {messages?.map((msg: any) => {
              const isError = msg.metadata?.error;
              const isStreaming = msg.status === "streaming";
              const isFailed =
                msg.role === "user" &&
                msg.status === "pending" &&
                // Consider a message "stuck" if it's been pending for over 60s
                Date.now() - msg.timestamp > 60_000;

              return (
                <div
                  key={msg._id}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                      msg.role === "user" ? "bg-blue-100 dark:bg-blue-900" : ""
                    }`}
                    style={
                      msg.role !== "user"
                        ? { backgroundColor: `${agent.color}20` }
                        : {}
                    }
                  >
                    {msg.role === "user" ? (
                      <User className="w-4 h-4" />
                    ) : isError ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      agent.emoji
                    )}
                  </div>
                  <div
                    className={`rounded-lg p-3 max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : isError
                          ? "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
                          : "bg-gray-100 dark:bg-gray-800"
                    }`}
                  >
                    <p
                      className={`text-sm whitespace-pre-wrap ${isError ? "text-red-700 dark:text-red-300" : ""}`}
                    >
                      {msg.content}
                      {isStreaming && (
                        <span className="inline-block w-1.5 h-4 bg-current opacity-70 animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] opacity-70">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                      {isStreaming && (
                        <span className="text-[10px] text-blue-500">
                          streaming...
                        </span>
                      )}
                      {isFailed && (
                        <button
                          onClick={() => handleRetry(msg)}
                          className="inline-flex items-center gap-1 text-[10px] text-red-500 hover:text-red-400"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="p-4 border-t flex gap-2 items-end flex-shrink-0"
        >
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}...`}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none"
            rows={1}
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!message.trim() || sending}
            className="flex-shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
