import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Navigation } from "./-ui.navigation";
import { Header } from "@/ui/header";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/_auth/dashboard/_layout")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { data: user, isLoading } = useQuery(convexQuery(api.app.getCurrentUser, {}));
  if (isLoading || !user) {
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
