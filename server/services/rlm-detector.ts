import { db } from "../db";
import { storage } from "../storage";
import type { 
  Game, 
  BettingPercentage, 
  LineMovement, 
  InsertRlmSignal 
} from "@shared/schema";

interface RlmAnalysis {
  isRlm: boolean;
  signalStrength: "strong" | "moderate" | "weak";
  ticketPercentage: number;
  moneyPercentage: number;
  lineMovementDirection: "up" | "down";
  lineMovementSize: number;
  side: string;
  marketType: string;
}

// Thresholds for RLM detection
const RLM_THRESHOLDS = {
  // Ticket/Money divergence thresholds
  STRONG_DIVERGENCE: 15, // 15%+ difference between tickets and money
  MODERATE_DIVERGENCE: 10,
  WEAK_DIVERGENCE: 5,
  
  // Line movement thresholds
  STRONG_MOVEMENT: 1.5, // 1.5+ point move
  MODERATE_MOVEMENT: 1.0,
  WEAK_MOVEMENT: 0.5,
  
  // Public ticket threshold (when public is heavily on one side)
  PUBLIC_THRESHOLD: 60, // 60%+ on one side
  HEAVY_PUBLIC: 70,
};

export function detectRlm(
  bettingPcts: BettingPercentage[],
  lineMovements: LineMovement[],
  marketType: string
): RlmAnalysis | null {
  // Get latest betting percentages for the market
  const latestPcts = bettingPcts
    .filter(p => p.marketType === marketType)
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
  
  if (!latestPcts) return null;
  
  // Get line movements for this market
  const movements = lineMovements
    .filter(m => m.marketType === marketType)
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
  
  if (movements.length === 0) return null;
  
  // Calculate total line movement
  const firstMovement = movements[0];
  const lastMovement = movements[movements.length - 1];
  const totalMovement = lastMovement.currentValue - firstMovement.previousValue;
  const movementDirection = totalMovement > 0 ? "up" : "down";
  const movementSize = Math.abs(totalMovement);
  
  // Determine which side has tickets vs money
  const ticketPct = latestPcts.ticketPercentage;
  const moneyPct = latestPcts.moneyPercentage;
  const side = latestPcts.side;
  
  // Calculate divergence (money moving opposite to tickets)
  const divergence = Math.abs(moneyPct - ticketPct);
  
  // Check for reverse line movement
  // RLM occurs when: public is heavily on one side, but line moves against them
  const publicSide = ticketPct > 50 ? side : (side === "home" ? "away" : "home");
  const moneySide = moneyPct > 50 ? side : (side === "home" ? "away" : "home");
  
  // Line moving toward money side indicates sharp action
  const isRlm = publicSide !== moneySide && 
                ticketPct >= RLM_THRESHOLDS.PUBLIC_THRESHOLD &&
                divergence >= RLM_THRESHOLDS.WEAK_DIVERGENCE &&
                movementSize >= RLM_THRESHOLDS.WEAK_MOVEMENT;
  
  if (!isRlm) return null;
  
  // Determine signal strength
  let signalStrength: "strong" | "moderate" | "weak" = "weak";
  
  if (
    divergence >= RLM_THRESHOLDS.STRONG_DIVERGENCE &&
    movementSize >= RLM_THRESHOLDS.STRONG_MOVEMENT &&
    ticketPct >= RLM_THRESHOLDS.HEAVY_PUBLIC
  ) {
    signalStrength = "strong";
  } else if (
    divergence >= RLM_THRESHOLDS.MODERATE_DIVERGENCE &&
    movementSize >= RLM_THRESHOLDS.MODERATE_MOVEMENT
  ) {
    signalStrength = "moderate";
  }
  
  return {
    isRlm: true,
    signalStrength,
    ticketPercentage: ticketPct,
    moneyPercentage: moneyPct,
    lineMovementDirection: movementDirection,
    lineMovementSize: movementSize,
    side: moneySide, // The side that sharp money is on
    marketType,
  };
}

export async function analyzeGameForRlm(gameId: number): Promise<InsertRlmSignal[]> {
  const signals: InsertRlmSignal[] = [];
  
  // Get betting percentages and line movements for this game
  const bettingPcts = await storage.getBettingPercentages(gameId);
  const lineMovements = await storage.getLineMovements(gameId);
  
  if (bettingPcts.length === 0 || lineMovements.length === 0) {
    return signals;
  }
  
  // Check each market type
  const marketTypes = ["spread", "total", "moneyline"];
  
  for (const marketType of marketTypes) {
    const analysis = detectRlm(bettingPcts, lineMovements, marketType);
    
    if (analysis && analysis.isRlm) {
      signals.push({
        gameId,
        marketType: analysis.marketType,
        side: analysis.side,
        ticketPercentage: analysis.ticketPercentage,
        moneyPercentage: analysis.moneyPercentage,
        lineMovementDirection: analysis.lineMovementDirection,
        lineMovementSize: analysis.lineMovementSize,
        signalStrength: analysis.signalStrength,
      });
    }
  }
  
  return signals;
}

export async function processAllGamesForRlm(): Promise<number> {
  // Get all scheduled games for today
  const games = await storage.getGamesToday();
  let signalCount = 0;
  
  for (const game of games) {
    const signals = await analyzeGameForRlm(game.id);
    
    for (const signal of signals) {
      await storage.createRlmSignal(signal);
      signalCount++;
    }
  }
  
  return signalCount;
}

// Handle split analysis - ticket % vs money %
export function analyzeHandleSplit(
  ticketPct: number,
  moneyPct: number
): {
  divergence: number;
  isSharpMoney: boolean;
  sharpSide: "public" | "sharp";
  recommendation: string;
} {
  const divergence = Math.abs(moneyPct - ticketPct);
  const isSharpMoney = divergence >= 10 && moneyPct > ticketPct;
  
  let recommendation = "";
  
  if (divergence >= 20) {
    recommendation = "Strong sharp money indicator. Consider fading the public.";
  } else if (divergence >= 15) {
    recommendation = "Moderate sharp money divergence. Worth monitoring.";
  } else if (divergence >= 10) {
    recommendation = "Slight sharp money lean detected.";
  } else {
    recommendation = "No significant handle split detected.";
  }
  
  return {
    divergence,
    isSharpMoney,
    sharpSide: isSharpMoney ? "sharp" : "public",
    recommendation,
  };
}
