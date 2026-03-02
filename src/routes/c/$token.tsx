import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, CheckCircle, Shield, ExternalLink } from "lucide-react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";

export const Route = createFileRoute("/c/$token")({
  component: PublicContractPage,
});

interface Contract {
  title: string;
  clientName: string;
  content: string;
  status: string;
  signedAt?: number;
  signatureData?: { name: string; agreedAt: number };
  expiresAt?: number;
  docusealSigningUrl?: string;
  signingMethod?: string;
}

function PublicContractPage() {
  const { token } = Route.useParams();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);

  const convexUrl = import.meta.env.VITE_CONVEX_URL?.replace(".cloud", ".site") ?? "";

  useEffect(() => {
    fetch(`${convexUrl}/api/contract/view?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setContract(data);
      })
      .catch(() => setError("Failed to load contract"))
      .finally(() => setLoading(false));
  }, [token, convexUrl]);

  const handleSign = async () => {
    if (!signatureName || !agreed) return;
    setSigning(true);
    try {
      const res = await fetch(`${convexUrl}/api/contract/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signatureName }),
      });
      const data = await res.json();
      if (data.success) {
        setContract((c) => c ? { ...c, status: "signed", signedAt: Date.now() } : c);
      }
    } catch {
      // Silent fail
    }
    setSigning(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Contract Not Found</h1>
          <p className="text-muted-foreground">{error || "This contract link may have expired."}</p>
        </div>
      </div>
    );
  }

  const isExpired = contract.expiresAt ? contract.expiresAt < Date.now() : false;
  const canSign = (contract.status === "sent" || contract.status === "viewed") && !isExpired;

  // Simple markdown-to-html (headings, bold, paragraphs, lists)
  const renderContent = (md: string) => {
    return md.split("\n").map((line, i) => {
      if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold mt-6 mb-2">{line.slice(2)}</h1>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-semibold mt-5 mb-2">{line.slice(3)}</h2>;
      if (line.startsWith("---")) return <hr key={i} className="my-4" />;
      if (line.startsWith("- ")) return <li key={i} className="ml-4">{line.slice(2)}</li>;
      if (line.trim() === "") return <br key={i} />;
      // Handle **bold**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i} className="leading-relaxed">
          {parts.map((part, pi) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return <strong key={pi}>{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{contract.title}</h1>
            <p className="text-muted-foreground">For {contract.clientName}</p>
          </div>
          <Badge variant={contract.status === "signed" ? "default" : "secondary"}>
            {contract.status}
          </Badge>
        </div>

        <div className="prose dark:prose-invert max-w-none mb-8 rounded-lg border p-6 bg-card">
          {renderContent(contract.content)}
        </div>

        {contract.status === "signed" && (
          <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950 rounded-lg text-green-700 dark:text-green-300 mb-8">
            <CheckCircle className="h-5 w-5" />
            <div>
              <span className="font-medium">This contract has been signed</span>
              {contract.signatureData && (
                <span className="text-sm ml-2">
                  by {contract.signatureData.name} on {new Date(contract.signatureData.agreedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        )}

        {canSign && contract.docusealSigningUrl && (
          <div className="border rounded-lg p-6 space-y-4 mt-8">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Sign This Contract</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              This contract requires a legally-binding electronic signature via DocuSeal.
            </p>
            <Button
              className="w-full"
              onClick={() => window.open(contract.docusealSigningUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Sign via DocuSeal
            </Button>
          </div>
        )}

        {canSign && !contract.docusealSigningUrl && (
          <div className="border rounded-lg p-6 space-y-4 mt-8">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Sign This Contract</h3>
            </div>

            <div>
              <Label>Your Full Name (as signature)</Label>
              <Input
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Enter your full legal name"
              />
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm">
                I have read and agree to all terms outlined in this contract. I understand this
                constitutes a legally binding agreement.
              </span>
            </label>

            <Button
              className="w-full"
              onClick={handleSign}
              disabled={!signatureName || !agreed || signing}
            >
              {signing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Sign Contract
            </Button>
          </div>
        )}

        <div className="mt-12 pt-8 border-t text-center text-xs text-muted-foreground">
          Powered by Modern Phase
        </div>
      </div>
    </div>
  );
}
