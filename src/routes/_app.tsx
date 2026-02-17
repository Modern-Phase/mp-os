import { convexQuery } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app")({
  component: Outlet,
  beforeLoad: async ({ context }) => {
    // Prefetch the user query but don't block on it — the user may not be authenticated yet.
    context.queryClient.prefetchQuery(
      convexQuery(api.app.getCurrentUser, {}),
    );
  },
});
