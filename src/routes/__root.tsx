import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import React, { Component, Suspense, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { usePostHog } from "posthog-js/react";
import { CookieConsent } from "@/components/CookieConsent";
import { useCookieConsent } from "@/components/CookieConsent";

const TanStackRouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null // Render nothing in production
    : React.lazy(() =>
        // Lazy load in development
        import("@tanstack/router-devtools").then((res) => ({
          default: res.TanStackRouterDevtools,
          // For Embedded Mode
          // default: res.TanStackRouterDevtoolsPanel
        })),
      );

/** Root error boundary: catches render errors and shows a fallback instead of a blank screen */
class RootErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Root error boundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-foreground">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground text-center text-sm">
            An unexpected error occurred. Try refreshing the page.
          </p>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RootComponent() {
  const router = useRouter();
  const location = useLocation();
  const posthog = usePostHog();
  const matchWithTitle = [...router.state.matches]
    .reverse()
    .find((d) => d.loaderData?.title);
  const title = matchWithTitle?.loaderData?.title || "MP AI Starter Kit";

  useEffect(() => {
    posthog?.capture("$pageview", { $current_url: location.href });
  }, [location.href, posthog]);

  const {} = useCookieConsent();

  const handleConsent = async (newConsents: Record<string, boolean>) => {
    // Here you could update the user's consent in your backend
    // Only call this if the user is authenticated
    try {
      // Example: Update user consent in backend if user is logged in
      console.log("Cookie consent updated:", newConsents);
    } catch (error) {
      console.error("Error updating consent:", error);
    }
  };

  return (
    <RootErrorBoundary>
      <Outlet />
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <CookieConsent onConsent={handleConsent} />
      <Suspense>
        <TanStackRouterDevtools />
      </Suspense>
    </RootErrorBoundary>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootComponent,
});
