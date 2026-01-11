import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RlmIndicator } from "@/components/rlm-indicator";
import { EmptyState } from "@/components/empty-state";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { RefreshCw, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RlmSignal, Game } from "@shared/schema";

interface RlmSignalsPageProps {
  activeSports: string[];
}

interface RlmSignalWithGame extends RlmSignal {
  game?: Game;
}

const sportStyles: Record<string, string> = {
  NFL: "bg-blue-500",
  NBA: "bg-orange-500",
  CFB: "bg-green-500",
  CBB: "bg-purple-500",
};

export function RlmSignalsPage({ activeSports }: RlmSignalsPageProps) {
  const sportsParam = activeSports.length > 0 ? `?sports=${activeSports.join(",")}` : "";
  
  const { data: signals, isLoading, refetch } = useQuery<RlmSignalWithGame[]>({
    queryKey: ["/api/rlm-signals", activeSports],
    queryFn: async () => {
      const res = await fetch(`/api/rlm-signals${sportsParam}`);
      if (!res.ok) throw new Error("Failed to fetch RLM signals");
      return res.json();
    },
  });

  const filtered = (signals || []).filter(
    signal => activeSports.length === 0 || (signal.game && activeSports.includes(signal.game.sport))
  );

  const strongSignals = filtered.filter(s => s.signalStrength === "strong");
  const moderateSignals = filtered.filter(s => s.signalStrength === "moderate");

  return (
    <div className="space-y-6" data-testid="rlm-signals-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reverse Line Movements</h1>
          <p className="text-sm text-muted-foreground">
            Sharp money indicators and line movement analysis
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => refetch()}
          data-testid="button-refresh-rlm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{strongSignals.length}</p>
                <p className="text-sm text-muted-foreground">Strong Signals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-yellow-500/10">
                <TrendingUp className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{moderateSignals.length}</p>
                <p className="text-sm text-muted-foreground">Moderate Signals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-chart-1/10">
                <AlertTriangle className="h-5 w-5 text-chart-1" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{filtered.length}</p>
                <p className="text-sm text-muted-foreground">Total RLM Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active RLM Signals</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-[80px]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No RLM Signals"
              description="No reverse line movements detected for the selected sports. Check back as lines move throughout the day."
              className="py-12"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sport</TableHead>
                    <TableHead>Game</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead className="text-right">Tickets</TableHead>
                    <TableHead className="text-right">Money</TableHead>
                    <TableHead className="text-right">Line Move</TableHead>
                    <TableHead>Strength</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((signal) => (
                    <TableRow key={signal.id} data-testid={`rlm-signal-${signal.id}`}>
                      <TableCell>
                        <Badge className={cn("text-xs", signal.game ? sportStyles[signal.game.sport] : "")}>
                          {signal.game?.sport || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {signal.game 
                          ? `${signal.game.awayTeamName} @ ${signal.game.homeTeamName}`
                          : "Unknown Game"
                        }
                      </TableCell>
                      <TableCell className="capitalize">{signal.marketType}</TableCell>
                      <TableCell className="text-right font-mono">
                        {signal.ticketPercentage.toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {signal.moneyPercentage.toFixed(0)}%
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-mono font-semibold",
                        signal.lineMovementDirection === "up" ? "text-green-500" : "text-red-500"
                      )}>
                        {signal.lineMovementDirection === "up" ? "+" : "-"}
                        {Math.abs(signal.lineMovementSize).toFixed(1)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={cn(
                            signal.signalStrength === "strong" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                            signal.signalStrength === "moderate" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                            "bg-muted text-muted-foreground"
                          )}
                        >
                          {signal.signalStrength}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground font-mono">
                        {new Date(signal.detectedAt).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {strongSignals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Strong Signal Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strongSignals.slice(0, 4).map(signal => (
              <RlmIndicator
                key={signal.id}
                ticketPercentage={signal.ticketPercentage}
                moneyPercentage={signal.moneyPercentage}
                lineMovementDirection={signal.lineMovementDirection as "up" | "down"}
                lineMovementSize={signal.lineMovementSize}
                signalStrength={signal.signalStrength as "strong" | "moderate" | "weak"}
                side={signal.side}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
