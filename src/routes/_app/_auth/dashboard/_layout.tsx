import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Navigation } from "./-ui.navigation";
import { Header } from "@/ui/header";
import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/_auth/dashboard/_layout")({
  component: DashboardLayout,
});

function DashboardLayout() {
  // Use the same query system as _auth.tsx (convex/react) so we share the
  // reactive subscription. _auth.tsx already guarantees a truthy user before
  // this layout renders, so this is just a safety net for the first frame.
  const user = useQuery(api.app.getCurrentUser);

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-secondary dark:bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <div className="flex min-h-[100vh] w-full flex-col bg-secondary dark:bg-black">
      <Navigation user={user} />
      <Header />
      <Outlet />
    </div>
  );
}
