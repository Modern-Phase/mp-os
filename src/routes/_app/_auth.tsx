import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useConvexAuth } from "convex/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { isAuthenticated: isConvexAuthed } = useConvexAuth();
  const navigate = useNavigate();
  const ensureUser = useMutation(api.app.ensureUser);
  const user = useQuery(api.app.getCurrentUser);
  const ensureUserCalled = useRef(false);

  useEffect(() => {
    // Redirect to login page if user is not authenticated in Clerk.
    if (isLoaded && !isSignedIn) {
      navigate({ to: "/login" });
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    // Wait until both Clerk AND Convex auth are ready before calling ensureUser.
    // This prevents the race where Clerk says isSignedIn but the Convex client
    // hasn't synced the JWT yet, causing ensureUser to see no identity.
    if (isLoaded && isSignedIn && isConvexAuthed && !ensureUserCalled.current) {
      ensureUserCalled.current = true;
      ensureUser();
    }
  }, [isLoaded, isSignedIn, isConvexAuthed]);

  // undefined = Convex subscription still loading
  // null     = query resolved but no user yet (ensureUser still running)
  // User     = ready to render
  if (!isLoaded || !isSignedIn || !user) {
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
