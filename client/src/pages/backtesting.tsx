import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BacktestResultsTable } from "@/components/backtest-results-table";
import { StatsCard } from "@/components/stats-card";
import { NoBacktestResults } from "@/components/empty-state";
import { Play, TrendingUp, DollarSign, Target, History } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BacktestResult } from "@shared/schema";

interface BacktestingPageProps {
  activeSports: string[];
}

export function BacktestingPage({ activeSports }: BacktestingPageProps) {
  const { toast } = useToast();
  const [sport, setSport] = useState<string>("all");
  const [signalType, setSignalType] = useState<string>("rlm");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: results, isLoading } = useQuery<BacktestResult[]>({
    queryKey: ["/api/backtest/results"],
  });

  const runBacktestMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/backtest/run", {
        sport: sport === "all" ? null : sport,
        signalType,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backtest/results"] });
      toast({
        title: "Backtest Complete",
        description: "Historical analysis has been completed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Backtest Failed",
        description: "There was an error running the backtest.",
        variant: "destructive",
      });
    },
  });

  const aggregateStats = results?.reduce((acc, r) => ({
    totalSignals: acc.totalSignals + r.totalSignals,
    wins: acc.wins + r.wins,
    losses: acc.losses + r.losses,
    pushes: acc.pushes + r.pushes,
  }), { totalSignals: 0, wins: 0, losses: 0, pushes: 0 });

  const overallWinPct = aggregateStats && aggregateStats.totalSignals > 0
    ? ((aggregateStats.wins / (aggregateStats.wins + aggregateStats.losses)) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-6" data-testid="backtesting-page">
      <div>
        <h1 className="text-2xl font-semibold">Backtesting</h1>
        <p className="text-sm text-muted-foreground">
          Validate signal performance using historical data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run New Backtest</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sport">Sport</Label>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger id="sport" data-testid="select-backtest-sport">
                  <SelectValue placeholder="Select sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sports</SelectItem>
                  <SelectItem value="NFL">NFL</SelectItem>
                  <SelectItem value="NBA">NBA</SelectItem>
                  <SelectItem value="CFB">CFB</SelectItem>
                  <SelectItem value="CBB">CBB</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signalType">Signal Type</Label>
              <Select value={signalType} onValueChange={setSignalType}>
                <SelectTrigger id="signalType" data-testid="select-signal-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rlm">RLM Signals</SelectItem>
                  <SelectItem value="handle_split">Handle Splits</SelectItem>
                  <SelectItem value="model_edge">Model Edge</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>

            <div className="flex items-end">
              <Button 
                onClick={() => runBacktestMutation.mutate()}
                disabled={runBacktestMutation.isPending}
                className="w-full"
                data-testid="button-run-backtest"
              >
                <Play className="h-4 w-4 mr-2" />
                {runBacktestMutation.isPending ? "Running..." : "Run Backtest"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total Signals"
          value={aggregateStats?.totalSignals ?? 0}
          subtitle="All backtested signals"
          icon={History}
        />
        <StatsCard
          title="Win Rate"
          value={`${overallWinPct}%`}
          subtitle="Overall performance"
          icon={Target}
          variant={parseFloat(overallWinPct) >= 55 ? "success" : "default"}
        />
        <StatsCard
          title="Wins"
          value={aggregateStats?.wins ?? 0}
          subtitle="Successful picks"
          icon={TrendingUp}
          variant="success"
        />
        <StatsCard
          title="Losses"
          value={aggregateStats?.losses ?? 0}
          subtitle="Failed picks"
          icon={DollarSign}
          variant="danger"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-[400px]" />
      ) : !results || results.length === 0 ? (
        <NoBacktestResults onRun={() => runBacktestMutation.mutate()} />
      ) : (
        <BacktestResultsTable results={results} />
      )}
    </div>
  );
}
