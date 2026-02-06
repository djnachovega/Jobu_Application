import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StatsCard } from "@/components/stats-card";
import { OpportunityCard } from "@/components/opportunity-card";
import { GameCard } from "@/components/game-card";
import { NoOpportunities, NoGames } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Target,
  TrendingUp,
  DollarSign,
  Calendar,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Opportunity, Game, Odds } from "@shared/schema";

interface DashboardProps {
  activeSports: string[];
}

interface DashboardStats {
  totalOpportunities: number;
  highConfidenceCount: number;
  rlmSignalsToday: number;
  gamesWithEdge: number;
}

interface GameWithOdds extends Game {
  latestOdds?: Odds;
  opportunityCount?: number;
}

interface PipelineStatus {
  lastRun: string | null;
  status: string;
  summary: {
    gamesScraped: number;
    projectionsGenerated: number;
    opportunitiesCreated: number;
    errorCount: number;
  } | null;
  errors: string[];
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

export function Dashboard({ activeSports }: DashboardProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sportsParam = activeSports.length > 0 ? `?sports=${activeSports.join(",")}` : "";

  // Pipeline status polling
  const { data: pipelineStatus } = useQuery<PipelineStatus>({
    queryKey: ["/api/pipeline/status"],
    refetchInterval: isRefreshing ? 3000 : 60000,
  });

  // When pipeline finishes while we're waiting, refresh all data
  useEffect(() => {
    if (isRefreshing && pipelineStatus?.status && pipelineStatus.status !== "running") {
      setIsRefreshing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games/today"] });

      if (pipelineStatus.status === "success") {
        toast({
          title: "Refresh Complete",
          description: `${pipelineStatus.summary?.projectionsGenerated ?? 0} projections, ${pipelineStatus.summary?.opportunitiesCreated ?? 0} opportunities found.`,
        });
      } else if (pipelineStatus.status === "error") {
        toast({
          title: "Refresh Failed",
          description: pipelineStatus.errors?.[0] || "Unknown error",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Refresh Complete",
          description: "Dashboard updated with latest data.",
        });
      }
    }
  }, [pipelineStatus?.status, isRefreshing]);

  const refreshMutation = useMutation({
    mutationFn: async () => {
      setIsRefreshing(true);
      return apiRequest("POST", "/api/pipeline/run");
    },
    onSuccess: () => {
      toast({
        title: "Refreshing Data",
        description: "Fetching latest schedules and odds. This may take 30-60 seconds.",
      });
      // Status polling (via refetchInterval above) will detect completion
    },
    onError: () => {
      setIsRefreshing(false);
      toast({
        title: "Refresh Failed",
        description: "Could not start pipeline. Please try again.",
        variant: "destructive",
      });
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", activeSports],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/stats${sportsParam}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: opportunities, isLoading: oppsLoading, refetch: refetchOpps } = useQuery<Opportunity[]>({
    queryKey: ["/api/opportunities", activeSports],
    queryFn: async () => {
      const res = await fetch(`/api/opportunities${sportsParam}`);
      if (!res.ok) throw new Error("Failed to fetch opportunities");
      return res.json();
    },
  });

  const { data: games, isLoading: gamesLoading } = useQuery<GameWithOdds[]>({
    queryKey: ["/api/games/today", activeSports],
    queryFn: async () => {
      const res = await fetch(`/api/games/today${sportsParam}`);
      if (!res.ok) throw new Error("Failed to fetch games");
      return res.json();
    },
  });

  const filteredOpportunities = opportunities?.filter(
    opp => activeSports.length === 0 || activeSports.includes(opp.sport)
  ) || [];

  const filteredGames = games?.filter(
    game => activeSports.length === 0 || activeSports.includes(game.sport)
  ) || [];

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">
              Today's betting opportunities and analysis
            </p>
            {pipelineStatus?.lastRun && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {pipelineStatus.status === "running" ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : pipelineStatus.status === "success" ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span>Updated {formatTimeAgo(pipelineStatus.lastRun)}</span>
                  </>
                ) : pipelineStatus.status === "error" ? (
                  <>
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span>Error {formatTimeAgo(pipelineStatus.lastRun)}</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-3 w-3" />
                    <span>Last run {formatTimeAgo(pipelineStatus.lastRun)}</span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={isRefreshing}
          data-testid="button-refresh-dashboard"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          <>
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-[120px]" />
            ))}
          </>
        ) : (
          <>
            <StatsCard
              title="Total Opportunities"
              value={stats?.totalOpportunities ?? 0}
              subtitle="Active plays today"
              icon={Target}
              variant="default"
            />
            <StatsCard
              title="High Confidence"
              value={stats?.highConfidenceCount ?? 0}
              subtitle="Strong edge plays"
              icon={DollarSign}
              variant="success"
            />
            <StatsCard
              title="RLM Signals"
              value={stats?.rlmSignalsToday ?? 0}
              subtitle="Reverse line movements"
              icon={TrendingUp}
              variant="warning"
            />
            <StatsCard
              title="Games with Edge"
              value={stats?.gamesWithEdge ?? 0}
              subtitle="Out of today's slate"
              icon={Calendar}
              variant="default"
            />
          </>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Top Opportunities</h2>
          <Link href="/opportunities">
            <Button variant="ghost" size="sm" data-testid="link-all-opportunities">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>

        {oppsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-[280px]" />
            ))}
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <NoOpportunities onRefresh={() => refetchOpps()} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOpportunities.slice(0, 6).map(opp => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                game={(opp as any).game}
                onClick={() => navigate(`/opportunities?gameId=${opp.gameId}`)}
              />
            ))}
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Today's Games</h2>
          <div className="flex items-center gap-2">
            {activeSports.length > 0 && (
              <div className="flex gap-1">
                {activeSports.map(sport => (
                  <Badge key={sport} variant="outline" className="text-xs">
                    {sport}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {gamesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-[200px]" />
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          <NoGames />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredGames.slice(0, 8).map(game => (
              <GameCard
                key={game.id}
                game={game}
                odds={game.latestOdds}
                hasOpportunity={(game.opportunityCount ?? 0) > 0}
                opportunityCount={game.opportunityCount}
                onClick={() => navigate(`/opportunities?gameId=${game.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
