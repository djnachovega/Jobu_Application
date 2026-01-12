import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Opportunity, Game } from "@shared/schema";

interface GameInfo {
  id?: number;
  sport?: string;
  awayTeamName?: string;
  homeTeamName?: string;
  gameDate?: string | Date;
  venue?: string;
  status?: string;
}

interface OpportunityCardProps {
  opportunity: Opportunity;
  game?: GameInfo;
  onClick?: () => void;
}

const confidenceStyles = {
  High: "bg-green-500/10 text-green-500 border-green-500/20",
  Medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  Lean: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

const sportStyles: Record<string, string> = {
  NFL: "bg-blue-500",
  NBA: "bg-orange-500",
  CFB: "bg-green-500",
  CBB: "bg-purple-500",
};

export function OpportunityCard({ opportunity, game, onClick }: OpportunityCardProps) {
  const drivers = (opportunity.drivers as string[]) || [];
  const volatilityLevel = opportunity.volatilityScore >= 65 ? "high" : opportunity.volatilityScore >= 45 ? "medium" : "low";

  return (
    <Card 
      className="hover-elevate cursor-pointer transition-all"
      onClick={onClick}
      data-testid={`opportunity-card-${opportunity.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn("text-xs", sportStyles[opportunity.sport])}>
                {opportunity.sport}
              </Badge>
              {opportunity.isReverseLineMovement && (
                <Badge variant="outline" className="text-xs border-chart-1 text-chart-1">
                  RLM
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-foreground truncate">
              {game?.awayTeamName || "Away"} @ {game?.homeTeamName || "Home"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {game?.gameDate ? new Date(game.gameDate).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              }) : "TBD"}
            </p>
          </div>
          <Badge 
            variant="outline" 
            className={cn("shrink-0", confidenceStyles[opportunity.confidence as keyof typeof confidenceStyles])}
          >
            {opportunity.confidence}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="rounded-md bg-muted/50 p-3 mb-3">
          <p className="font-mono text-sm font-semibold text-foreground">
            {opportunity.playDescription}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Edge</p>
            <p className={cn(
              "font-mono text-sm font-semibold",
              opportunity.edgePercentage >= 4 ? "text-green-500" : 
              opportunity.edgePercentage >= 2.5 ? "text-yellow-500" : "text-foreground"
            )}>
              {opportunity.edgePercentage >= 0 ? "+" : ""}{opportunity.edgePercentage.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Market</p>
            <p className="font-mono text-sm font-semibold">
              {opportunity.currentLine !== null ? 
                (opportunity.currentLine > 0 ? "+" : "") + opportunity.currentLine : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Fair</p>
            <p className="font-mono text-sm font-semibold">
              {opportunity.fairLine !== null ? 
                (opportunity.fairLine > 0 ? "+" : "") + opportunity.fairLine?.toFixed(1) : "—"}
            </p>
          </div>
        </div>

        {opportunity.currentLine !== null && opportunity.fairLine !== null && (
          <div className="mt-2 flex items-center justify-center">
            {Math.abs(opportunity.currentLine - opportunity.fairLine) >= 1 ? (
              <div className="flex items-center gap-1 text-xs text-green-500">
                <TrendingUp className="h-3 w-3" />
                <span>{Math.abs(opportunity.currentLine - opportunity.fairLine).toFixed(1)} pts of value</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{Math.abs(opportunity.currentLine - opportunity.fairLine).toFixed(1)} pts edge</span>
              </div>
            )}
          </div>
        )}

        {(opportunity.ticketPercentage || opportunity.moneyPercentage) && (
          <>
            <Separator className="my-3" />
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Tickets</p>
                <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-blue-500/70 rounded-full"
                    style={{ width: `${opportunity.ticketPercentage || 0}%` }}
                  />
                </div>
                <p className="font-mono text-xs mt-1">{opportunity.ticketPercentage?.toFixed(0)}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Money</p>
                <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className={cn(
                      "absolute left-0 top-0 h-full rounded-full",
                      opportunity.moneyPercentage && opportunity.ticketPercentage && 
                      Math.abs((opportunity.moneyPercentage || 0) - (opportunity.ticketPercentage || 0)) > 10
                        ? "bg-green-500/70"
                        : "bg-orange-500/70"
                    )}
                    style={{ width: `${opportunity.moneyPercentage || 0}%` }}
                  />
                </div>
                <p className="font-mono text-xs mt-1">{opportunity.moneyPercentage?.toFixed(0)}%</p>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <div className="w-full">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">Volatility</span>
            <span className={cn(
              "font-mono font-medium",
              volatilityLevel === "high" ? "text-red-500" : 
              volatilityLevel === "medium" ? "text-yellow-500" : "text-green-500"
            )}>
              V={opportunity.volatilityScore}
            </span>
          </div>
          
          {drivers.length > 0 && (
            <div className="space-y-1">
              {drivers.slice(0, 2).map((driver, idx) => (
                <p key={idx} className="text-xs text-muted-foreground truncate">
                  {driver}
                </p>
              ))}
              {drivers.length > 2 && (
                <p className="text-xs text-muted-foreground">+{drivers.length - 2} more</p>
              )}
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
