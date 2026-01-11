import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RlmIndicatorProps {
  ticketPercentage: number;
  moneyPercentage: number;
  lineMovementDirection: "up" | "down";
  lineMovementSize: number;
  signalStrength: "strong" | "moderate" | "weak";
  side: string;
  compact?: boolean;
}

export function RlmIndicator({
  ticketPercentage,
  moneyPercentage,
  lineMovementDirection,
  lineMovementSize,
  signalStrength,
  side,
  compact = false,
}: RlmIndicatorProps) {
  const strengthStyles = {
    strong: "bg-green-500/10 text-green-500 border-green-500/20",
    moderate: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    weak: "bg-muted text-muted-foreground border-muted",
  };

  const isSharpMoney = moneyPercentage > ticketPercentage + 10;
  const publicSide = ticketPercentage > 50 ? side : side === "home" ? "away" : "home";
  const sharpSide = moneyPercentage > 50 ? side : side === "home" ? "away" : "home";

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn("cursor-help", strengthStyles[signalStrength])}
            data-testid="rlm-indicator-compact"
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            RLM
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold">Reverse Line Movement</p>
            <p className="text-sm">
              {ticketPercentage.toFixed(0)}% of tickets on {publicSide}, but line moved {lineMovementDirection} {Math.abs(lineMovementSize).toFixed(1)} pts toward {sharpSide}
            </p>
            <p className="text-xs text-muted-foreground">Signal Strength: {signalStrength}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div 
      className="rounded-md border bg-card p-4 space-y-3"
      data-testid="rlm-indicator-full"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-chart-1/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-chart-1" />
          </div>
          <div>
            <p className="font-semibold text-sm">Reverse Line Movement</p>
            <p className="text-xs text-muted-foreground">{signalStrength} signal</p>
          </div>
        </div>
        <Badge variant="outline" className={strengthStyles[signalStrength]}>
          {signalStrength.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-2 rounded-md bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">Public Tickets</p>
          <p className="font-mono text-lg font-semibold">{ticketPercentage.toFixed(0)}%</p>
          <p className="text-xs text-muted-foreground">{publicSide}</p>
        </div>
        <div className="text-center p-2 rounded-md bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">Sharp Money</p>
          <p className="font-mono text-lg font-semibold">{moneyPercentage.toFixed(0)}%</p>
          <p className="text-xs text-muted-foreground">{sharpSide}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 p-2 rounded-md bg-chart-1/5">
        {lineMovementDirection === "up" ? (
          <TrendingUp className="h-4 w-4 text-chart-1" />
        ) : (
          <TrendingDown className="h-4 w-4 text-destructive" />
        )}
        <span className="text-sm font-medium">
          Line moved {Math.abs(lineMovementSize).toFixed(1)} pts {lineMovementDirection}
        </span>
      </div>

      {isSharpMoney && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3 text-yellow-500" />
          <span>Sharp money divergence: {(moneyPercentage - ticketPercentage).toFixed(0)}% gap</span>
        </div>
      )}
    </div>
  );
}
