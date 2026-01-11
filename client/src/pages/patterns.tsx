import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Zap, TrendingUp, Lightbulb, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PatternDiscovery } from "@shared/schema";

interface PatternsPageProps {
  activeSports: string[];
}

export function PatternsPage({ activeSports }: PatternsPageProps) {
  const sportsParam = activeSports.length > 0 ? `?sports=${activeSports.join(",")}` : "";
  
  const { data: patterns, isLoading, refetch } = useQuery<PatternDiscovery[]>({
    queryKey: ["/api/patterns", activeSports],
    queryFn: async () => {
      const res = await fetch(`/api/patterns${sportsParam}`);
      if (!res.ok) throw new Error("Failed to fetch patterns");
      return res.json();
    },
  });

  const filtered = (patterns || []).filter(
    p => activeSports.length === 0 || !p.sport || activeSports.includes(p.sport)
  );

  const activePatterns = filtered.filter(p => p.isActive);

  return (
    <div className="space-y-6" data-testid="patterns-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Pattern Discovery</h1>
          <p className="text-sm text-muted-foreground">
            Machine learning insights from betting data analysis
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => refetch()}
          data-testid="button-refresh-patterns"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{activePatterns.length}</p>
                <p className="text-sm text-muted-foreground">Active Patterns</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">
                  {activePatterns.filter(p => p.confidence >= 0.75).length}
                </p>
                <p className="text-sm text-muted-foreground">High Confidence</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-yellow-500/10">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">
                  {new Set(activePatterns.map(p => p.patternType)).size}
                </p>
                <p className="text-sm text-muted-foreground">Pattern Types</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-[150px]" />
          ))}
        </div>
      ) : activePatterns.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No Patterns Discovered"
          description="The AI is analyzing your betting data. Patterns will appear here as they are identified."
        />
      ) : (
        <div className="space-y-4">
          {activePatterns.map((pattern) => (
            <PatternCard key={pattern.id} pattern={pattern} />
          ))}
        </div>
      )}
    </div>
  );
}

function PatternCard({ pattern }: { pattern: PatternDiscovery }) {
  const confidencePct = (pattern.confidence * 100).toFixed(0);
  const confidenceLevel = pattern.confidence >= 0.75 ? "high" : pattern.confidence >= 0.5 ? "medium" : "low";

  return (
    <Card data-testid={`pattern-card-${pattern.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-md",
              confidenceLevel === "high" ? "bg-green-500/10" :
              confidenceLevel === "medium" ? "bg-yellow-500/10" : "bg-muted"
            )}>
              <Zap className={cn(
                "h-5 w-5",
                confidenceLevel === "high" ? "text-green-500" :
                confidenceLevel === "medium" ? "text-yellow-500" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <CardTitle className="text-base">{formatPatternType(pattern.patternType)}</CardTitle>
              <p className="text-xs text-muted-foreground">
                Discovered {new Date(pattern.discoveredAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pattern.sport && (
              <Badge variant="outline">{pattern.sport}</Badge>
            )}
            <Badge 
              variant="outline"
              className={cn(
                confidenceLevel === "high" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                confidenceLevel === "medium" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                "bg-muted text-muted-foreground"
              )}
            >
              {confidencePct}% confidence
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{pattern.description}</p>
        
        {pattern.recommendation && (
          <div className="p-3 rounded-md bg-primary/5 border border-primary/10">
            <p className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Recommendation
            </p>
            <p className="text-sm text-muted-foreground mt-1">{pattern.recommendation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatPatternType(type: string): string {
  const mapping: Record<string, string> = {
    rlm_correlation: "RLM Correlation Pattern",
    handle_pattern: "Handle Split Pattern",
    efficiency_trend: "Efficiency Trend",
    venue_advantage: "Venue Advantage Pattern",
    pace_matchup: "Pace Matchup Pattern",
  };
  return mapping[type] || type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}
