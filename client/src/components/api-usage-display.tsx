
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, Zap, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ApiUsageStats {
  requestCount: number;
  totalTokens: number;
  lastRequestTime: string;
  rateLimitRemaining?: number;
  rateLimitReset?: string;
}

interface ApiUsageDisplayProps {
  apiKey: string;
  className?: string;
}

export function ApiUsageDisplay({ apiKey, className }: ApiUsageDisplayProps) {
  const { data: usage, isLoading } = useQuery<ApiUsageStats>({
    queryKey: ["api-usage", apiKey],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/usage-stats", { apiKey });
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!apiKey,
  });

  if (isLoading || !usage) {
    return null;
  }

  const rateLimitPercent = usage.rateLimitRemaining 
    ? ((60 - usage.rateLimitRemaining) / 60) * 100 
    : 0;

  const getRateLimitStatus = () => {
    if (!usage.rateLimitRemaining) return "unknown";
    if (usage.rateLimitRemaining < 10) return "critical";
    if (usage.rateLimitRemaining < 20) return "warning";
    return "good";
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" />
          API Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="w-3 h-3" />
              Requests
            </div>
            <div className="font-medium">{formatNumber(usage.requestCount)}</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="w-3 h-3" />
              Tokens
            </div>
            <div className="font-medium">{formatNumber(usage.totalTokens)}</div>
          </div>
        </div>

        {usage.rateLimitRemaining !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Rate Limit</span>
              <Badge 
                variant={getRateLimitStatus() === "good" ? "default" : 
                        getRateLimitStatus() === "warning" ? "secondary" : "destructive"}
                className="text-xs"
              >
                {usage.rateLimitRemaining} left
              </Badge>
            </div>
            <Progress value={rateLimitPercent} className="h-1" />
            {getRateLimitStatus() === "critical" && (
              <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                <AlertTriangle className="w-3 h-3" />
                Rate limit approaching
              </div>
            )}
          </div>
        )}

        {usage.lastRequestTime && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            Last: {new Date(usage.lastRequestTime).toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
