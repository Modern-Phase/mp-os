import { createFileRoute } from "@tanstack/react-router";
import { ChatInterface } from "@/components/ChatInterface";

export const Route = createFileRoute("/_app/_auth/chat")({
  component: ChatPage,
  beforeLoad: () => ({
    title: "AI Chat",
  }),
});

function ChatPage() {
  return (
    <div className="h-screen w-screen">
      <ChatInterface />
    </div>
  );
}
