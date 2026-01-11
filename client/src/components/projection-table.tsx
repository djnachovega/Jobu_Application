import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ProjectionMetric {
  label: string;
  away: string | number | null;
  home: string | number | null;
  highlight?: "away" | "home" | null;
}

interface ProjectionTableProps {
  awayTeam: string;
  homeTeam: string;
  metrics: ProjectionMetric[];
  projectedAwayScore: number;
  projectedHomeScore: number;
  fairSpread: number;
  fairTotal: number;
  volatilityScore: number;
  algorithmVersion: string;
  blendBreakdown?: {
    homeAway: number;
    season: number;
    recent: number;
  };
  sosAdjustment?: number;
}

export function ProjectionTable({
  awayTeam,
  homeTeam,
  metrics,
  projectedAwayScore,
  projectedHomeScore,
  fairSpread,
  fairTotal,
  volatilityScore,
  algorithmVersion,
  blendBreakdown,
  sosAdjustment,
}: ProjectionTableProps) {
  const volatilityLevel = volatilityScore >= 65 ? "high" : volatilityScore >= 45 ? "medium" : "low";

  return (
    <Card data-testid="projection-table">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Projection Analysis</CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            {algorithmVersion}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Metric</th>
                <th className="text-right py-2 px-3 font-medium">{awayTeam}</th>
                <th className="text-right py-2 px-3 font-medium">{homeTeam}</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric, idx) => (
                <tr 
                  key={idx} 
                  className={cn(
                    "border-b border-border/50",
                    metric.highlight && "bg-primary/5"
                  )}
                >
                  <td className="py-2 px-3 text-muted-foreground">{metric.label}</td>
                  <td className={cn(
                    "text-right py-2 px-3 font-mono",
                    metric.highlight === "away" && "text-green-500 font-semibold"
                  )}>
                    {metric.away ?? "—"}
                  </td>
                  <td className={cn(
                    "text-right py-2 px-3 font-mono",
                    metric.highlight === "home" && "text-green-500 font-semibold"
                  )}>
                    {metric.home ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Projection Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Projected Score</p>
              <p className="font-mono text-lg font-semibold">
                {projectedAwayScore.toFixed(1)} - {projectedHomeScore.toFixed(1)}
              </p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Fair Spread</p>
              <p className="font-mono text-lg font-semibold">
                {fairSpread > 0 ? "+" : ""}{fairSpread.toFixed(1)}
              </p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Fair Total</p>
              <p className="font-mono text-lg font-semibold">{fairTotal.toFixed(1)}</p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Volatility</p>
              <p className={cn(
                "font-mono text-lg font-semibold",
                volatilityLevel === "high" ? "text-red-500" : 
                volatilityLevel === "medium" ? "text-yellow-500" : "text-green-500"
              )}>
                V={volatilityScore}
              </p>
            </div>
          </div>
        </div>

        {blendBreakdown && (
          <div className="flex items-center justify-between text-xs text-muted-foreground p-2 rounded-md bg-muted/30">
            <span>Efficiency Blend:</span>
            <span className="font-mono">
              {blendBreakdown.homeAway}% H/A + {blendBreakdown.season}% Season + {blendBreakdown.recent}% Recent
            </span>
          </div>
        )}

        {sosAdjustment !== undefined && sosAdjustment !== 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground p-2 rounded-md bg-muted/30">
            <span>SoS Adjustment:</span>
            <span className="font-mono">
              {sosAdjustment > 0 ? "+" : ""}{sosAdjustment.toFixed(1)}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
