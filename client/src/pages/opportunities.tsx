import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { OpportunityCard } from "@/components/opportunity-card";
import { NoOpportunities } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  RefreshCw, 
  Search,
  Filter,
  SortAsc,
  SortDesc,
  X,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import type { Opportunity, Game } from "@shared/schema";

interface OpportunityWithGame extends Opportunity {
  game?: {
    id: number;
    sport: string;
    awayTeamName: string;
    homeTeamName: string;
    gameDate: string;
    venue?: string;
    status?: string;
  };
}

interface OpportunitiesPageProps {
  activeSports: string[];
}

type SortOption = "edge" | "confidence" | "volatility" | "time";
type ConfidenceFilter = "all" | "High" | "Medium" | "Lean";
type MarketFilter = "all" | "spread" | "total" | "moneyline";

export function OpportunitiesPage({ activeSports }: OpportunitiesPageProps) {
  const searchParams = useSearch();
  const [, navigate] = useLocation();
  const gameIdParam = new URLSearchParams(searchParams).get("gameId");
  const gameId = gameIdParam ? parseInt(gameIdParam) : undefined;
  
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("edge");
  const [sortDesc, setSortDesc] = useState(true);
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [rlmOnly, setRlmOnly] = useState(false);

  const sportsParam = activeSports.length > 0 ? `sports=${activeSports.join(",")}` : "";
  const gameIdQueryParam = gameId ? `gameId=${gameId}` : "";
  const queryParams = [sportsParam, gameIdQueryParam].filter(Boolean).join("&");
  const queryString = queryParams ? `?${queryParams}` : "";
  
  const { data: opportunities, isLoading, refetch } = useQuery<OpportunityWithGame[]>({
    queryKey: ["/api/opportunities", activeSports, gameId],
    queryFn: async () => {
      const res = await fetch(`/api/opportunities${queryString}`);
      if (!res.ok) throw new Error("Failed to fetch opportunities");
      return res.json();
    },
  });
  
  const selectedGame = gameId && opportunities?.[0]?.game;

  const filtered = (opportunities || [])
    .filter(opp => {
      if (activeSports.length > 0 && !activeSports.includes(opp.sport)) return false;
      if (confidenceFilter !== "all" && opp.confidence !== confidenceFilter) return false;
      if (marketFilter !== "all" && opp.marketType !== marketFilter) return false;
      if (rlmOnly && !opp.isReverseLineMovement) return false;
      if (search && !opp.playDescription.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "edge":
          comparison = a.edgePercentage - b.edgePercentage;
          break;
        case "confidence":
          const confOrder = { High: 3, Medium: 2, Lean: 1 };
          comparison = (confOrder[a.confidence as keyof typeof confOrder] || 0) - 
                       (confOrder[b.confidence as keyof typeof confOrder] || 0);
          break;
        case "volatility":
          comparison = a.volatilityScore - b.volatilityScore;
          break;
        case "time":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDesc ? -comparison : comparison;
    });

  const highCount = filtered.filter(o => o.confidence === "High").length;
  const mediumCount = filtered.filter(o => o.confidence === "Medium").length;
  const rlmCount = filtered.filter(o => o.isReverseLineMovement).length;

  return (
    <div className="space-y-6" data-testid="opportunities-page">
      <div className="flex items-center justify-between">
        <div>
          {gameId && (
            <Link href="/opportunities">
              <Button variant="ghost" size="sm" className="mb-2 -ml-2" data-testid="button-back-all">
                <ArrowLeft className="h-4 w-4 mr-1" />
                All Opportunities
              </Button>
            </Link>
          )}
          <h1 className="text-2xl font-semibold">
            {selectedGame 
              ? `${selectedGame.awayTeamName} @ ${selectedGame.homeTeamName}` 
              : "Opportunities"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {gameId 
              ? `${filtered.length} plays for this game`
              : `${filtered.length} active opportunities across all markets`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {gameId && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/opportunities")}
              data-testid="button-clear-filter"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filter
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-opportunities"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-card border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search plays..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-opportunities"
          />
        </div>

        <Select value={confidenceFilter} onValueChange={(v) => setConfidenceFilter(v as ConfidenceFilter)}>
          <SelectTrigger className="w-[140px]" data-testid="select-confidence">
            <SelectValue placeholder="Confidence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Confidence</SelectItem>
            <SelectItem value="High">High Only</SelectItem>
            <SelectItem value="Medium">Medium Only</SelectItem>
            <SelectItem value="Lean">Lean Only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={marketFilter} onValueChange={(v) => setMarketFilter(v as MarketFilter)}>
          <SelectTrigger className="w-[140px]" data-testid="select-market">
            <SelectValue placeholder="Market" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Markets</SelectItem>
            <SelectItem value="spread">Spread</SelectItem>
            <SelectItem value="total">Total</SelectItem>
            <SelectItem value="moneyline">Moneyline</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={rlmOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setRlmOnly(!rlmOnly)}
          data-testid="button-rlm-filter"
        >
          RLM Only
        </Button>

        <div className="flex items-center gap-1 border-l pl-3">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[120px]" data-testid="select-sort">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="edge">Edge %</SelectItem>
              <SelectItem value="confidence">Confidence</SelectItem>
              <SelectItem value="volatility">Volatility</SelectItem>
              <SelectItem value="time">Time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSortDesc(!sortDesc)}
            data-testid="button-sort-direction"
          >
            {sortDesc ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-500/10 text-green-500">
            {highCount} High
          </Badge>
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
            {mediumCount} Medium
          </Badge>
          <Badge variant="outline" className="bg-chart-1/10 text-chart-1">
            {rlmCount} RLM
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-[280px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <NoOpportunities onRefresh={() => refetch()} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(opp => (
            <OpportunityCard 
              key={opp.id} 
              opportunity={opp}
              game={opp.game}
              onClick={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
