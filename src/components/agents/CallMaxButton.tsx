// src/components/agents/CallMaxButton.tsx
// Prominent button to initiate a voice call with Max (Operations Director)

import { useMutation, useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import { Phone, PhoneCall, Loader2 } from "lucide-react";
import { useState } from "react";

interface CallMaxButtonProps {
  orgId: Id<"organizations">;
  variant?: "default" | "prominent";
}

export function CallMaxButton({ orgId, variant = "default" }: CallMaxButtonProps) {
  const activeCall = useQuery(api.retellCalls.getActiveCall, { orgId });
  const initiateCall = useMutation(api.retellCalls.initiateCall);
  const [isInitiating, setIsInitiating] = useState(false);

  const isOnCall = activeCall && (activeCall.status === "ongoing" || activeCall.status === "registered" || activeCall.status === "initiating");

  const handleCall = async () => {
    if (isOnCall) return;
    setIsInitiating(true);
    try {
      await initiateCall({ orgId, agentId: "max" });
    } catch (err) {
      console.error("Failed to initiate call:", err);
    } finally {
      setIsInitiating(false);
    }
  };

  if (isOnCall) {
    return (
      <Button
        variant="outline"
        size={variant === "prominent" ? "lg" : "sm"}
        className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
        disabled
      >
        <PhoneCall className="w-4 h-4 mr-2 animate-pulse" />
        On Call with Max
      </Button>
    );
  }

  if (variant === "prominent") {
    return (
      <Button
        size="lg"
        onClick={handleCall}
        disabled={isInitiating}
        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
      >
        {isInitiating ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Phone className="w-4 h-4 mr-2" />
        )}
        Call Max
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCall}
      disabled={isInitiating}
      className="border-blue-500/50 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
    >
      {isInitiating ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Phone className="w-4 h-4 mr-2" />
      )}
      Call Max
    </Button>
  );
}
