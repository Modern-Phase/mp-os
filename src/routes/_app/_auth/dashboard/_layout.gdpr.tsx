import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import {
  Download,
  Trash2,
  Eye,
  Shield,
  CheckCircle,
  AlertCircle,
  Clock,
  Mail,
} from "lucide-react";
import { useQuery as useTanstackQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";

export const Route = createFileRoute("/_app/_auth/dashboard/_layout/gdpr")({
  component: GdprRequests,
  beforeLoad: () => ({
    title: "Data & Privacy",
    headerTitle: "Data & Privacy",
    headerDescription: "Manage your data and privacy settings.",
  }),
});

function GdprRequests() {
  const queryClient = useQueryClient();
  const [consents, setConsents] = useState({
    analytics: false,
    marketing: false,
    functional: false,
  });

  const user = useQuery(api.app.getCurrentUser);
  const { data: userConsents } = useTanstackQuery(
    convexQuery(api.gdpr.getUserConsents, {}),
  );

  // exportUserData is a query, so we use useTanstackQuery instead of useMutation
  const { isLoading: isExporting, refetch: refetchExport } = useTanstackQuery({
    queryKey: ["user-data-export"],
    queryFn: () => convexQuery(api.gdpr.exportUserData, {}),
    enabled: false, // Don't fetch automatically
  });

  const handleExportData = async () => {
    try {
      const data = await refetchExport();
      if (data.data) {
        // Create and download JSON file
        const blob = new Blob([JSON.stringify(data.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `data-export-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const updateConsentMutation = useConvexMutation(api.gdpr.updateConsent);
  const { mutate: updateConsents, isPending: isUpdatingConsents } = useMutation(
    {
      mutationFn: (args: any) => updateConsentMutation(args),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [api.gdpr.getUserConsents] });
      },
    },
  );

  const deleteUserDataMutation = useConvexMutation(api.gdpr.deleteUserData);
  const { mutate: deleteData, isPending: isDeleting } = useMutation({
    mutationFn: (args: any) => deleteUserDataMutation(args),
    onSuccess: () => {
      // Redirect to login page after successful deletion
      window.location.href = "/login";
    },
  });

  const handleConsentUpdate = () => {
    updateConsents({
      consents: [
        { type: "analytics", granted: consents.analytics },
        { type: "marketing", granted: consents.marketing },
        { type: "functional", granted: consents.functional },
      ],
      version: "1.0",
    });
  };

  const handleDeleteAccount = () => {
    // SECURITY: Double confirmation with specific text to prevent accidental deletion
    const confirmation = prompt(
      "To permanently delete your account, type 'DELETE MY ACCOUNT' below:",
    );

    if (confirmation === "DELETE MY ACCOUNT") {
      // SECURITY: Add additional verification step
      const finalConfirmation = confirm(
        "FINAL WARNING: This will permanently delete ALL your data including documents, chat history, and settings. This action CANNOT be undone. Are you absolutely sure?",
      );

      if (finalConfirmation) {
        deleteData({ confirmation: true });
      }
    } else if (confirmation !== null) {
      alert("Confirmation text does not match. Account deletion cancelled.");
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* User Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Your Data
          </CardTitle>
          <CardDescription>
            View and manage the personal data we store about you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Account Information</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Email:</strong> {user?.email || "Not available"}
                </p>
                <p>
                  <strong>Username:</strong> {user?.username || "Not set"}
                </p>
                <p>
                  <strong>Account ID:</strong> {user?._id}
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Data Summary</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Documents:</strong> View in dashboard
                </p>
                <p>
                  <strong>Chat History:</strong> View in dashboard
                </p>
                <p>
                  <strong>Settings:</strong> Manage below
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download a copy of all your personal data in JSON format.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This includes your profile information, documents, chat history,
              and account settings. The export will be generated in real-time
              and downloaded as a JSON file.
            </p>
            <Button
              onClick={handleExportData}
              disabled={isExporting}
              className="w-full md:w-auto"
            >
              {isExporting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Generating Export...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export All Data
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Consent Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy Consent
          </CardTitle>
          <CardDescription>
            Manage your consent preferences for data processing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose how we can use your data to provide and improve our
              services.
            </p>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <label htmlFor="analytics" className="font-medium text-sm">
                  Analytics Cookies
                </label>
                <p className="text-xs text-muted-foreground">
                  Help us understand how you use our service
                </p>
              </div>
              <input
                type="checkbox"
                id="analytics"
                checked={consents.analytics}
                onChange={(e) =>
                  setConsents((prev) => ({
                    ...prev,
                    analytics: e.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <label htmlFor="marketing" className="font-medium text-sm">
                  Marketing Communications
                </label>
                <p className="text-xs text-muted-foreground">
                  Receive updates about new features and offers
                </p>
              </div>
              <input
                type="checkbox"
                id="marketing"
                checked={consents.marketing}
                onChange={(e) =>
                  setConsents((prev) => ({
                    ...prev,
                    marketing: e.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <label htmlFor="functional" className="font-medium text-sm">
                  Functional Cookies
                </label>
                <p className="text-xs text-muted-foreground">
                  Remember your preferences and settings
                </p>
              </div>
              <input
                type="checkbox"
                id="functional"
                checked={consents.functional}
                onChange={(e) =>
                  setConsents((prev) => ({
                    ...prev,
                    functional: e.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
            </div>

            <Button
              onClick={handleConsentUpdate}
              disabled={isUpdatingConsents}
              className="w-full md:w-auto"
            >
              {isUpdatingConsents ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Preferences"
              )}
            </Button>

            {/* Current Consents Display */}
            {userConsents && userConsents.length > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <h4 className="font-medium text-sm mb-2">Current Consents</h4>
                <div className="flex flex-wrap gap-2">
                  {userConsents.map((consent) => (
                    <Badge
                      key={consent.consentType}
                      variant={consent.granted ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {consent.consentType}:{" "}
                      {consent.granted ? "Granted" : "Denied"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive mb-1">
                  Warning: This action cannot be undone
                </p>
                <p className="text-muted-foreground">
                  Deleting your account will permanently remove:
                </p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>• Your profile and account information</li>
                  <li>• All uploaded documents and files</li>
                  <li>• Chat history and conversations</li>
                  <li>• Settings and preferences</li>
                  <li>
                    • Subscription data (billing records kept for legal
                    compliance)
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Mail className="h-5 w-5 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Need help?</p>
                <p className="text-muted-foreground">
                  If you have questions about data deletion or want to request a
                  specific type of data removal, contact our support team at
                  privacy@modernphase.io
                </p>
              </div>
            </div>

            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="w-full md:w-auto"
            >
              {isDeleting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Deleting Account...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete My Account
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <Eye className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h4 className="font-medium text-sm">View Privacy Policy</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Learn how we protect your data
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h4 className="font-medium text-sm">Terms of Service</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Review our service terms
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h4 className="font-medium text-sm">Data Compliance</h4>
            <p className="text-xs text-muted-foreground mt-1">
              GDPR & privacy compliance
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
