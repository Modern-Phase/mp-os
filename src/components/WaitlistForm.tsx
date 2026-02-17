import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinWaitlist = useMutation(api.waitlist.join);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);
    try {
      await joinWaitlist({ email, name });
      setJoined(true);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (joined) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 rounded-2xl bg-primary/5 border border-primary/10 animate-in fade-in zoom-in duration-500">
        <div className="bg-primary/10 p-3 rounded-full">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-2xl font-bold text-primary mt-2">
          You're on the list!
        </h3>
        <p className="text-muted-foreground text-center max-w-[300px]">
          We'll notify you as soon as we're ready for more users. Stay tuned!
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-card/50 border-primary/10 h-11"
          />
          <Input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-card/50 border-primary/10 h-11"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 p-2 rounded border border-destructive/10">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 text-base font-semibold"
        >
          {loading ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            "Get Early Access"
          )}
        </Button>
        <p className="text-[10px] text-center text-muted-foreground uppercase tracking-wider font-medium">
          Join 500+ developers in the queue
        </p>
      </form>
    </div>
  );
}
