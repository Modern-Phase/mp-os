import { createFileRoute } from "@tanstack/react-router";
import siteConfig from "~/site.config";
import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Users, CreditCard, Activity } from "lucide-react";

export const Route = createFileRoute("/_app/_auth/dashboard/_layout/")({
  component: Dashboard,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Dashboard`,
    headerTitle: "Dashboard",
    headerDescription: "Manage your Apps and view your usage.",
  }),
});

export default function Dashboard() {
  const user = useQuery(api.app.getCurrentUser);

  // Only fetch admin stats if the user is a system admin
  const adminStats = useQuery(api.admin.getStats, user?.isAdmin ? {} : "skip");

  return (
    <div className="flex h-full w-full flex-col gap-8 bg-secondary px-6 py-8 dark:bg-black">
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-8">
        {/* User Welcome Section */}
        <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
          <div className="flex w-full flex-col rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">Dashboard</h2>
              <p className="text-sm font-normal text-primary/60">
                Welcome back{user?.username ? `, ${user.username}` : ""}.
              </p>
              {user?.memberships && user.memberships.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {user.memberships.map((m) => (
                    <span
                      key={m._id}
                      className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                    >
                      {m.role}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Admin Section (Visible only to admins) */}
        {user?.isAdmin && adminStats && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-primary">
                Platform Overview
              </h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Admin
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Users
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {adminStats.totalUsers ?? "..."}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Subscriptions
                  </CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {adminStats.totalSubscriptions ?? "..."}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Subs
                  </CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {adminStats.activeSubscriptions ?? "..."}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
