import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Game, Odds } from "@shared/schema";

interface GameCardProps {
  game: Game;
  odds?: Odds;
  hasOpportunity?: boolean;
  opportunityCount?: number;
  onClick?: () => void;
}

const sportStyles: Record<string, string> = {
  NFL: "bg-blue-500",
  NBA: "bg-orange-500",
  CFB: "bg-green-500",
  CBB: "bg-purple-500",
};

export function GameCard({ 
  game, 
  odds, 
  hasOpportunity, 
  opportunityCount,
  onClick 
}: GameCardProps) {
  const gameDate = new Date(game.gameDate);
  const isLive = game.status === "live";
  const isFinal = game.status === "final";

  return (
    <Card 
      className={cn(
        "hover-elevate cursor-pointer transition-all",
        hasOpportunity && "ring-1 ring-primary/50"
      )}
      onClick={onClick}
      data-testid={`game-card-${game.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <Badge className={cn("text-xs", sportStyles[game.sport])}>
            {game.sport}
          </Badge>
          <div className="flex items-center gap-2">
            {isLive && (
              <Badge variant="destructive" className="text-xs animate-pulse">
                LIVE
              </Badge>
            )}
            {isFinal && (
              <Badge variant="secondary" className="text-xs">
                FINAL
              </Badge>
            )}
            {hasOpportunity && opportunityCount && (
              <Badge variant="default" className="text-xs">
                {opportunityCount} {opportunityCount === 1 ? "play" : "plays"}
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{game.awayTeamName}</span>
            {(isLive || isFinal) && game.awayScore !== null && (
              <span className="font-mono text-lg font-bold">{game.awayScore}</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">{game.homeTeamName}</span>
            {(isLive || isFinal) && game.homeScore !== null && (
              <span className="font-mono text-lg font-bold">{game.homeScore}</span>
            )}
          </div>
        </div>

        {odds && (
          <div className="grid grid-cols-3 gap-2 text-center p-2 rounded-md bg-muted/50 mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Spread</p>
              <p className="font-mono text-sm font-medium">
                {odds.spreadHome !== null ? (odds.spreadHome > 0 ? "+" : "") + odds.spreadHome : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-mono text-sm font-medium">
                {odds.totalOver !== null ? `O/U ${odds.totalOver}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ML</p>
              <p className="font-mono text-sm font-medium">
                {odds.moneylineHome !== null ? (odds.moneylineHome > 0 ? "+" : "") + odds.moneylineHome : "—"}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {gameDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {" "}
              {gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
          {game.venue && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{game.venue}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
