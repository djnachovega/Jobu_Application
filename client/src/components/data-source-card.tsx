import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DataSource } from "@shared/schema";

interface DataSourceCardProps {
  source: DataSource;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function DataSourceCard({ source, onRefresh, isRefreshing }: DataSourceCardProps) {
  const StatusIcon = source.lastRefreshStatus === "success" ? CheckCircle : 
                     source.lastRefreshStatus === "error" ? XCircle : Clock;
  
  const statusColor = source.lastRefreshStatus === "success" ? "text-green-500" : 
                      source.lastRefreshStatus === "error" ? "text-red-500" : "text-muted-foreground";

  const timeSinceRefresh = source.lastRefreshAt 
    ? formatTimeAgo(new Date(source.lastRefreshAt))
    : "Never";

  return (
    <Card data-testid={`data-source-card-${source.name}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-lg">{source.displayName}</h3>
            <p className="text-sm text-muted-foreground">{source.name}</p>
          </div>
          <Badge variant={source.isActive ? "default" : "secondary"}>
            {source.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <div className="flex items-center gap-1">
              {StatusIcon && <StatusIcon className={cn("h-4 w-4", statusColor)} />}
              <span className={statusColor}>
                {source.lastRefreshStatus || "Pending"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last Refresh</span>
            <span className="font-mono text-xs">{timeSinceRefresh}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Interval</span>
            <span className="font-mono text-xs">{source.refreshIntervalMinutes}m</span>
          </div>

          {source.requiresAuth && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Auth Required</span>
              <Badge variant="outline" className="text-xs">Credentials Set</Badge>
            </div>
          )}

          {source.lastRefreshError && (
            <div className="mt-2 p-2 rounded-md bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-500 truncate">{source.lastRefreshError}</p>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-3 gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={onRefresh}
          disabled={isRefreshing}
          data-testid={`button-refresh-${source.name}`}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          {isRefreshing ? "Refreshing..." : "Refresh Now"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
