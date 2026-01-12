import { db } from "../db";
import { games, opportunities, odds, projections, backtestResults } from "@shared/schema";
import { eq, and, gte, lte, desc, sql, isNotNull } from "drizzle-orm";
import type { InsertBacktestResult } from "@shared/schema";

interface BacktestConfig {
  sport: string;
  signalType: "all" | "rlm" | "edge" | "high_confidence";
  dateFrom: Date;
  dateTo: Date;
  minEdge?: number;
  minConfidence?: string;
}

interface BacktestOutcome {
  opportunityId: number;
  gameId: number;
  marketType: string;
  side: string;
  currentLine: number;
  result: "win" | "loss" | "push";
  actualMargin?: number;
  profitUnits: number;
}

interface BacktestSummary {
  totalSignals: number;
  wins: number;
  losses: number;
  pushes: number;
  winPercentage: number;
  roi: number;
  avgEdge: number;
  unitsProfitLoss: number;
  byConfidence: {
    high: { wins: number; losses: number; pushes: number };
    medium: { wins: number; losses: number; pushes: number };
    lean: { wins: number; losses: number; pushes: number };
  };
  byMarketType: {
    spread: { wins: number; losses: number; pushes: number };
    total: { wins: number; losses: number; pushes: number };
  };
}

function determineSpreadResult(
  side: string,
  line: number,
  homeScore: number,
  awayScore: number
): "win" | "loss" | "push" {
  const actualMargin = homeScore - awayScore;
  
  if (side === "home") {
    const coverMargin = actualMargin + line;
    if (coverMargin > 0) return "win";
    if (coverMargin < 0) return "loss";
    return "push";
  } else {
    const coverMargin = -(actualMargin) + line;
    if (coverMargin > 0) return "win";
    if (coverMargin < 0) return "loss";
    return "push";
  }
}

function determineTotalResult(
  side: string,
  line: number,
  homeScore: number,
  awayScore: number
): "win" | "loss" | "push" {
  const actualTotal = homeScore + awayScore;
  
  if (side === "over") {
    if (actualTotal > line) return "win";
    if (actualTotal < line) return "loss";
    return "push";
  } else {
    if (actualTotal < line) return "win";
    if (actualTotal > line) return "loss";
    return "push";
  }
}

export async function runBacktest(config: BacktestConfig): Promise<BacktestSummary> {
  const { sport, signalType, dateFrom, dateTo, minEdge, minConfidence } = config;
  
  // Build conditions array, only including conditions that are actually set
  const conditions = [
    gte(games.gameDate, dateFrom),
    lte(games.gameDate, dateTo),
    eq(games.status, "final"),
    isNotNull(games.homeScore),
    isNotNull(games.awayScore),
  ];
  
  // Add optional filters only when they have meaningful values
  if (sport && sport !== "ALL") {
    conditions.push(eq(games.sport, sport));
  }
  
  if (signalType === "rlm") {
    conditions.push(eq(opportunities.isReverseLineMovement, true));
  } else if (signalType === "high_confidence") {
    conditions.push(eq(opportunities.confidence, "High"));
  }
  
  if (minEdge !== undefined && minEdge > 0) {
    conditions.push(gte(opportunities.edgePercentage, minEdge));
  }
  
  if (minConfidence && minConfidence !== "") {
    conditions.push(eq(opportunities.confidence, minConfidence));
  }
  
  const completedGames = await db
    .select({
      game: games,
      opportunity: opportunities,
    })
    .from(opportunities)
    .innerJoin(games, eq(opportunities.gameId, games.id))
    .where(and(...conditions));
  
  const outcomes: BacktestOutcome[] = [];
  
  for (const row of completedGames) {
    const { game, opportunity } = row;
    
    if (game.homeScore === null || game.awayScore === null) continue;
    
    let result: "win" | "loss" | "push";
    
    if (opportunity.marketType === "spread") {
      result = determineSpreadResult(
        opportunity.side,
        opportunity.currentLine || 0,
        game.homeScore,
        game.awayScore
      );
    } else {
      result = determineTotalResult(
        opportunity.side,
        opportunity.currentLine || 0,
        game.homeScore,
        game.awayScore
      );
    }
    
    const profitUnits = result === "win" ? 0.91 : result === "loss" ? -1 : 0;
    
    outcomes.push({
      opportunityId: opportunity.id,
      gameId: game.id,
      marketType: opportunity.marketType,
      side: opportunity.side,
      currentLine: opportunity.currentLine || 0,
      result,
      actualMargin: game.homeScore - game.awayScore,
      profitUnits,
    });
  }
  
  const wins = outcomes.filter(o => o.result === "win").length;
  const losses = outcomes.filter(o => o.result === "loss").length;
  const pushes = outcomes.filter(o => o.result === "push").length;
  const totalSignals = outcomes.length;
  
  const winPercentage = totalSignals > 0 ? (wins / (wins + losses)) * 100 : 0;
  const unitsProfitLoss = outcomes.reduce((sum, o) => sum + o.profitUnits, 0);
  const roi = (wins + losses) > 0 ? (unitsProfitLoss / (wins + losses)) * 100 : 0;
  
  const avgEdge = completedGames.length > 0
    ? completedGames.reduce((sum, r) => sum + (r.opportunity.edgePercentage || 0), 0) / completedGames.length
    : 0;
  
  const byConfidence = {
    high: { wins: 0, losses: 0, pushes: 0 },
    medium: { wins: 0, losses: 0, pushes: 0 },
    lean: { wins: 0, losses: 0, pushes: 0 },
  };
  
  const byMarketType = {
    spread: { wins: 0, losses: 0, pushes: 0 },
    total: { wins: 0, losses: 0, pushes: 0 },
  };
  
  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    const confidence = completedGames[i].opportunity.confidence?.toLowerCase() as "high" | "medium" | "lean";
    const marketType = outcome.marketType as "spread" | "total";
    
    if (confidence && byConfidence[confidence]) {
      byConfidence[confidence][outcome.result === "push" ? "pushes" : outcome.result === "win" ? "wins" : "losses"]++;
    }
    
    if (byMarketType[marketType]) {
      byMarketType[marketType][outcome.result === "push" ? "pushes" : outcome.result === "win" ? "wins" : "losses"]++;
    }
  }
  
  return {
    totalSignals,
    wins,
    losses,
    pushes,
    winPercentage: Math.round(winPercentage * 10) / 10,
    roi: Math.round(roi * 10) / 10,
    avgEdge: Math.round(avgEdge * 10) / 10,
    unitsProfitLoss: Math.round(unitsProfitLoss * 100) / 100,
    byConfidence,
    byMarketType,
  };
}

export async function saveBacktestResult(
  config: BacktestConfig,
  summary: BacktestSummary
) {
  const [result] = await db
    .insert(backtestResults)
    .values({
      sport: config.sport,
      signalType: config.signalType,
      dateRangeStart: config.dateFrom,
      dateRangeEnd: config.dateTo,
      totalSignals: summary.totalSignals,
      wins: summary.wins,
      losses: summary.losses,
      pushes: summary.pushes,
      winPercentage: summary.winPercentage,
      roi: summary.roi,
      averageEdge: summary.avgEdge,
      highConfidenceRecord: summary.byConfidence.high,
      mediumConfidenceRecord: summary.byConfidence.medium,
      leanConfidenceRecord: summary.byConfidence.lean,
      parameters: {
        minEdge: config.minEdge,
        minConfidence: config.minConfidence,
        unitsProfitLoss: summary.unitsProfitLoss,
        byMarketType: summary.byMarketType,
      },
    })
    .returning();
  
  return result;
}
