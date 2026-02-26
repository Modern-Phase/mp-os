import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/ui/button";
import { Textarea } from "@/ui/textarea";
import { Badge } from "@/ui/badge";

export const Route = createFileRoute("/p/$token")({
  component: PublicProposalPage,
});

interface ProposalSection {
  title: string;
  description: string;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
}

interface Proposal {
  title: string;
  clientName: string;
  sections: ProposalSection[];
  totalValue: number;
  currency: string;
  status: string;
  validUntil: number;
  notes?: string;
}

function PublicProposalPage() {
  const { token } = Route.useParams();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionStatus, setActionStatus] = useState<"idle" | "accepting" | "rejecting" | "done">("idle");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const convexUrl = import.meta.env.VITE_CONVEX_URL?.replace(".cloud", ".site") ?? "";

  useEffect(() => {
    fetch(`${convexUrl}/api/proposal/view?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setProposal(data);
        }
      })
      .catch(() => setError("Failed to load proposal"))
      .finally(() => setLoading(false));
  }, [token, convexUrl]);

  const handleAccept = async () => {
    setActionStatus("accepting");
    try {
      const res = await fetch(`${convexUrl}/api/proposal/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) {
        setActionStatus("done");
        setProposal((p) => p ? { ...p, status: "accepted" } : p);
      }
    } catch {
      setActionStatus("idle");
    }
  };

  const handleReject = async () => {
    setActionStatus("rejecting");
    try {
      const res = await fetch(`${convexUrl}/api/proposal/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reason: rejectReason || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setActionStatus("done");
        setProposal((p) => p ? { ...p, status: "rejected" } : p);
      }
    } catch {
      setActionStatus("idle");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Proposal Not Found</h1>
          <p className="text-muted-foreground">{error || "This proposal link may have expired."}</p>
        </div>
      </div>
    );
  }

  const isExpired = proposal.validUntil < Date.now();
  const canRespond = (proposal.status === "sent" || proposal.status === "viewed") && !isExpired;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{proposal.title}</h1>
            <Badge variant={proposal.status === "accepted" ? "default" : "secondary"}>
              {proposal.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Prepared for {proposal.clientName} &middot; Valid until{" "}
            {new Date(proposal.validUntil).toLocaleDateString()}
            {isExpired && <span className="text-destructive ml-2">(Expired)</span>}
          </p>
        </div>

        {proposal.sections.map((section, si) => (
          <div key={si} className="mb-8">
            <h2 className="text-xl font-semibold mb-1">{section.title}</h2>
            <p className="text-muted-foreground mb-4">{section.description}</p>
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2">Item</th>
                    <th className="text-right px-4 py-2 w-20">Qty</th>
                    <th className="text-right px-4 py-2 w-28">Price</th>
                    <th className="text-right px-4 py-2 w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item, ii) => (
                    <tr key={ii} className="border-b last:border-0">
                      <td className="px-4 py-2">{item.description}</td>
                      <td className="px-4 py-2 text-right">{item.quantity}</td>
                      <td className="px-4 py-2 text-right">${item.unitPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-medium">${item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="flex justify-end mb-8">
          <div className="rounded-lg border p-4 w-64">
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>${proposal.totalValue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {proposal.notes && (
          <div className="mb-8 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">{proposal.notes}</p>
          </div>
        )}

        {proposal.status === "accepted" && (
          <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950 rounded-lg text-green-700 dark:text-green-300">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">This proposal has been accepted.</span>
          </div>
        )}

        {proposal.status === "rejected" && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950 rounded-lg text-red-700 dark:text-red-300">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">This proposal has been declined.</span>
          </div>
        )}

        {canRespond && (
          <div className="flex flex-col gap-4 mt-8 pt-8 border-t">
            {showReject && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Reason for declining (optional)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                />
              </div>
            )}
            <div className="flex gap-3 justify-end">
              {!showReject ? (
                <Button variant="outline" onClick={() => setShowReject(true)} disabled={actionStatus !== "idle"}>
                  Decline
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleReject} disabled={actionStatus !== "idle"}>
                  {actionStatus === "rejecting" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirm Decline
                </Button>
              )}
              <Button onClick={handleAccept} disabled={actionStatus !== "idle"}>
                {actionStatus === "accepting" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Accept Proposal
              </Button>
            </div>
          </div>
        )}

        <div className="mt-12 pt-8 border-t text-center text-xs text-muted-foreground">
          Powered by Modern Phase
        </div>
      </div>
    </div>
  );
}
