import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { RouterProvider } from "@tanstack/react-router";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { PostHogProvider } from "posthog-js/react";
import { router } from "@/router";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import "@/i18n";

// Convex client
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

const convexQueryClient = new ConvexQueryClient(convex);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
  },
});

convexQueryClient.connect(queryClient);

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const posthogOptions = {
  api_host: (import.meta.env.VITE_POSTHOG_HOST as string) || "https://us.i.posthog.com",
  capture_pageview: false, // we track pageviews manually via the router
};

function InnerApp() {
  return <RouterProvider router={router} context={{ queryClient }} />;
}

const helmetContext = {};

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <PostHogProvider
        apiKey={import.meta.env.VITE_POSTHOG_KEY as string}
        options={posthogOptions}
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <HelmetProvider context={helmetContext}>
            <QueryClientProvider client={queryClient}>
              <InnerApp />
            </QueryClientProvider>
          </HelmetProvider>
        </ConvexProviderWithClerk>
      </PostHogProvider>
    </ClerkProvider>
  );
}
