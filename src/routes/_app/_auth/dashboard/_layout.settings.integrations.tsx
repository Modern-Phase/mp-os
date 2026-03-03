import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Loader2, Link2, Unlink, RefreshCw, CheckCircle, AlertCircle, XCircle, GitBranch } from "lucide-react";
import { Link } from "@tanstack/react-router";
import siteConfig from "~/site.config";

export const Route = createFileRoute(
  "/_app/_auth/dashboard/_layout/settings/integrations",
)({
  component: IntegrationsSettingsPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Integrations`,
  }),
});

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  active: { label: "Connected", icon: CheckCircle, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
  expired: { label: "Expired", icon: AlertCircle, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" },
  error: { label: "Error", icon: XCircle, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
  disconnected: { label: "Disconnected", icon: Unlink, color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
};

function IntegrationsSettingsPage() {
  const currentUser = useConvexQuery(api.app.getCurrentUser);
  const orgId = currentUser?.memberships?.[0]?.orgId as Id<"organizations"> | undefined;

  const ensurePersonalOrg = useMutation(api.organizations.ensurePersonalOrg);
  const [orgEnsured, setOrgEnsured] = useState(false);
  useEffect(() => {
    if (currentUser && !orgId && !orgEnsured) {
      setOrgEnsured(true);
      ensurePersonalOrg().catch(console.error);
    }
  }, [currentUser, orgId, orgEnsured, ensurePersonalOrg]);

  const isQBConfigured = useConvexQuery(api.quickbooks.isQBConfigured);
  const qbConnection = useConvexQuery(api.quickbooks.getQBConnectionStatus, orgId ? { orgId } : "skip");
  const getOAuthUrl = useMutation(api.quickbooks.getOAuthUrl);
  const disconnectQB = useMutation(api.quickbooks.disconnectQuickBooks);
  const syncInvoices = useMutation(api.quickbooks.syncAllInvoices);
  const syncCustomers = useMutation(api.quickbooks.syncAllCustomers);

  const isDocuSealConfigured = useConvexQuery(api.docuseal.isDocuSealConfigured);

  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!orgId) return;
    setConnecting(true);
    try {
      const url = await getOAuthUrl({ orgId });
      window.location.href = url;
    } catch (err) {
      console.error("Failed to get OAuth URL:", err);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!orgId) return;
    try {
      await disconnectQB({ orgId });
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  };

  const handleSync = async (type: "invoices" | "customers") => {
    if (!orgId) return;
    setSyncing(type);
    try {
      if (type === "invoices") await syncInvoices({ orgId });
      else await syncCustomers({ orgId });
    } catch (err) {
      console.error(`Failed to sync ${type}:`, err);
    }
    setSyncing(null);
  };

  // Check URL params for connection result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("qb") === "connected") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const qbStatus = qbConnection?.status || null;
  const statusConfig = qbStatus ? STATUS_CONFIG[qbStatus] : null;

  return (
    <div className="flex-1 space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">Connect external services to sync your data</p>
      </div>

      {/* QuickBooks Card */}
      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <span className="text-lg font-bold text-green-700 dark:text-green-300">QB</span>
            </div>
            <div>
              <h3 className="font-medium">QuickBooks Online</h3>
              <p className="text-sm text-muted-foreground">Sync invoices, customers, and expenses</p>
            </div>
          </div>
          {statusConfig && (
            <Badge className={statusConfig.color}>
              <statusConfig.icon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          )}
        </div>

        {!isQBConfigured ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            QuickBooks integration requires <code>QB_CLIENT_ID</code>, <code>QB_CLIENT_SECRET</code>, and <code>QB_REDIRECT_URI</code> environment variables to be configured.
          </div>
        ) : qbStatus === "active" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Connected: </span>
                <span>{qbConnection?.connectedAt ? new Date(qbConnection.connectedAt).toLocaleDateString() : "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Last sync: </span>
                <span>{qbConnection?.lastSyncAt ? new Date(qbConnection.lastSyncAt).toLocaleString() : "Never"}</span>
              </div>
              {qbConnection?.realmId && (
                <div>
                  <span className="text-muted-foreground">Company ID: </span>
                  <span className="font-mono text-xs">{qbConnection.realmId}</span>
                </div>
              )}
            </div>

            {qbConnection?.lastError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
                {qbConnection.lastError}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleSync("invoices")} disabled={syncing === "invoices"}>
                {syncing === "invoices" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Sync Invoices
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSync("customers")} disabled={syncing === "customers"}>
                {syncing === "customers" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Sync Customers
              </Button>
              <div className="flex-1" />
              <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                <Unlink className="h-4 w-4 mr-1" /> Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
            Connect QuickBooks
          </Button>
        )}
      </div>

      {/* DocuSeal Card */}
      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span className="text-lg font-bold text-blue-700 dark:text-blue-300">DS</span>
            </div>
            <div>
              <h3 className="font-medium">DocuSeal</h3>
              <p className="text-sm text-muted-foreground">Legally-binding electronic signatures for contracts</p>
            </div>
          </div>
          {isDocuSealConfigured ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
              <CheckCircle className="h-3 w-3 mr-1" /> Configured
            </Badge>
          ) : (
            <Badge variant="secondary">Not Configured</Badge>
          )}
        </div>

        {isDocuSealConfigured ? (
          <div className="text-sm text-muted-foreground">
            DocuSeal is configured and ready. When sending contracts, toggle "E-Signature" to use DocuSeal
            for legally-robust signing with audit trails.
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            DocuSeal requires <code>DOCUSEAL_API_URL</code> and <code>DOCUSEAL_API_KEY</code> environment variables.
            DocuSeal is self-hosted — deploy it to your VPS and configure the URL here.
          </div>
        )}
      </div>

      {/* GitHub Card */}
      <GitHubIntegrationCard orgId={orgId} />
    </div>
  );
}

function GitHubIntegrationCard({ orgId }: { orgId?: Id<"organizations"> }) {
  const ghConnection = useConvexQuery(api.github.getConnection, orgId ? { orgId } : "skip");
  const disconnectGitHub = useMutation(api.github.disconnectGitHub);

  const ghStatus = ghConnection?.status || null;
  const statusConfig = ghStatus ? STATUS_CONFIG[ghStatus] : null;

  const handleDisconnect = async () => {
    if (!orgId) return;
    try {
      await disconnectGitHub({ orgId });
    } catch (err) {
      console.error("Failed to disconnect GitHub:", err);
    }
  };

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <GitBranch className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </div>
          <div>
            <h3 className="font-medium">GitHub</h3>
            <p className="text-sm text-muted-foreground">Track repos, commits, PRs, and issues</p>
          </div>
        </div>
        {statusConfig && (
          <Badge className={statusConfig.color}>
            <statusConfig.icon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        )}
      </div>

      {ghStatus === "active" ? (
        <div className="space-y-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Connected: </span>
            <span>{ghConnection?.connectedAt ? new Date(ghConnection.connectedAt).toLocaleDateString() : "—"}</span>
          </div>
          <div className="flex gap-2">
            <Link to="/dashboard/github" className="text-sm text-primary hover:underline">
              Manage Repos →
            </Link>
            <div className="flex-1" />
            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
              <Unlink className="h-4 w-4 mr-1" /> Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Connect your GitHub account with a Personal Access Token to track repos, view commits, PRs, and issues.
          </div>
          <Link to="/dashboard/github">
            <Button>
              <Link2 className="h-4 w-4 mr-2" />
              Connect GitHub
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
