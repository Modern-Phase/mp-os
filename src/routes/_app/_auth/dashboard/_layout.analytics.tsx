import { createFileRoute } from "@tanstack/react-router";
import siteConfig from "~/site.config";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { api } from "@cvx/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { ScrollArea } from "@/ui/scroll-area";
import {
  Loader2,
  DollarSign,
  Activity,
  MessageSquare,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { cn } from "@/utils/misc";

interface HeliconeRequest {
  id: string;
  created_at: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  user_id?: string;
  status: number;
}

export function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("7d");
  const getMetricsForCurrentUser = useAction(
    api.helicone.getMetricsForCurrentUser,
  );

  // Fetch Helicone metrics via Convex action (API key stays on server)
  const { data: response, isLoading } = useQuery({
    queryKey: ["helicone-metrics", dateRange],
    queryFn: async () => {
      const endDate = new Date().toISOString();
      const startDate = new Date(
        Date.now() -
          (dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90) *
            24 *
            60 *
            60 *
            1000,
      ).toISOString();
      try {
        return await getMetricsForCurrentUser({ startDate, endDate });
      } catch (error) {
        console.error("Error fetching Helicone metrics:", error);
        return { data: [] as HeliconeRequest[] };
      }
    },
  });

  const metrics = ((response as any)?.data ?? []) as HeliconeRequest[];

  // Calculate stats
  const stats = {
    totalRequests: metrics?.length || 0,
    totalCost: metrics?.reduce((sum, req) => sum + (req.cost_usd || 0), 0) || 0,
    totalTokens:
      metrics?.reduce(
        (sum, req) =>
          sum + (req.prompt_tokens || 0) + (req.completion_tokens || 0),
        0,
      ) || 0,
    avgCostPerRequest: metrics?.length
      ? metrics.reduce((sum, req) => sum + (req.cost_usd || 0), 0) /
        metrics.length
      : 0,
  };

  // Group by model
  const modelStats = metrics?.reduce(
    (acc, req) => {
      const model = req.model || "unknown";
      if (!acc[model]) {
        acc[model] = { count: 0, cost: 0, tokens: 0 };
      }
      acc[model].count++;
      acc[model].cost += req.cost_usd || 0;
      acc[model].tokens +=
        (req.prompt_tokens || 0) + (req.completion_tokens || 0);
      return acc;
    },
    {} as Record<string, { count: number; cost: number; tokens: number }>,
  );

  return (
    <div className="flex-1 p-6">
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">
              Monitor AI usage, costs, and performance metrics
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1">
              {(["7d", "30d", "90d"] as const).map((range) => (
                <Button
                  key={range}
                  variant={dateRange === range ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateRange(range)}
                >
                  {range === "7d"
                    ? "7 Days"
                    : range === "30d"
                      ? "30 Days"
                      : "90 Days"}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Requests
                  </CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalRequests.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI API calls in the last {dateRange}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Cost
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${stats.totalCost.toFixed(4)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Estimated API costs
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Tokens
                  </CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalTokens.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Prompt + completion tokens
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Avg Cost/Request
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${stats.avgCostPerRequest.toFixed(6)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Average per API call
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Model Breakdown */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Model Usage</CardTitle>
                  <CardDescription>Breakdown by AI model</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {modelStats && Object.entries(modelStats).length > 0 ? (
                      <div className="space-y-4">
                        {Object.entries(modelStats)
                          .sort(([, a], [, b]) => b.count - a.count)
                          .map(([model, modelStat]) => (
                            <div
                              key={model}
                              className="flex items-center justify-between p-3 rounded-lg border"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{model}</p>
                                  <Badge variant="secondary">
                                    {modelStat.count} requests
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {modelStat.tokens.toLocaleString()} tokens
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">
                                  ${modelStat.cost.toFixed(4)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {(
                                    (modelStat.cost / (stats.totalCost || 1)) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Activity className="mx-auto h-12 w-12 mb-2 opacity-50" />
                        <p>No data available</p>
                        <p className="text-sm">
                          Start using AI chat to see metrics
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Recent Requests */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Requests</CardTitle>
                  <CardDescription>Latest AI API calls</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {metrics && metrics.length > 0 ? (
                      <div className="space-y-2">
                        {metrics.slice(0, 20).map((request) => (
                          <div
                            key={request.id}
                            className="flex items-center justify-between p-3 rounded-lg border text-sm"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {request.model}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(request.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge
                                variant={
                                  request.status === 200
                                    ? "default"
                                    : "destructive"
                                }
                                className={cn(
                                  "text-xs",
                                  request.status === 200 &&
                                    "bg-green-100 text-green-800",
                                )}
                              >
                                {request.status === 200 ? "Success" : "Error"}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                ${request.cost_usd?.toFixed(6) || "0.000000"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50" />
                        <p>No recent requests</p>
                        <p className="text-sm">
                          Chat activity will appear here
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Helicone Dashboard Link */}
            <Card className="mt-6">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h3 className="font-semibold">Helicone Dashboard</h3>
                  <p className="text-sm text-muted-foreground">
                    View detailed analytics in the Helicone platform
                  </p>
                </div>
                <Button asChild>
                  <a
                    href="https://app.helicone.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Helicone
                  </a>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/_auth/dashboard/_layout/analytics")(
  {
    component: AnalyticsPage,
    beforeLoad: () => ({
      title: `${siteConfig.siteTitle} - Analytics`,
      headerTitle: "Analytics",
      headerDescription: "Monitor AI usage, costs, and performance metrics.",
    }),
  },
);
