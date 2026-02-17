import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();
  const ensureUser = useMutation(api.app.ensureUser);
  const user = useQuery(api.app.getCurrentUser);

  useEffect(() => {
    // Redirect to login page if user is not authenticated in Clerk.
    if (isLoaded && !isSignedIn) {
      navigate({ to: "/login" });
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      ensureUser();
    }
  }, [isLoaded, isSignedIn]);

  // Wait for both Clerk and Convex user to be loaded
  if (!isLoaded || !isSignedIn || user === undefined) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Authenticating session...
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
