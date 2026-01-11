import type { 
  TeamStats, 
  Game, 
  InsertProjection,
  InsertOpportunity 
} from "@shared/schema";

// Algorithm versions
export const ALGORITHM_VERSIONS = {
  NFL: "NFL v4.0R1",
  NBA: "NBA v3.5R1",
  CFB: "CFB v3.5R1",
  CBB: "CBB v3.6R1",
};

// Efficiency blend weights per sport
const BLEND_WEIGHTS = {
  NFL: { homeAway: 55, season: 35, recent: 10 },
  NBA: { homeAway: 50, season: 40, recent: 10 },
  CFB: { homeAway: 55, season: 35, recent: 10 },
  CBB: { homeAway: 50, season: 40, recent: 10 },
};

// Home/away adjustment factors
const VENUE_ADJUSTMENTS = {
  NFL: { home: 2.5, away: -2.5 },      // Points
  NBA: { home: 3.0, away: -3.0 },      // Points
  CFB: { home: 3.0, away: -3.0 },      // Points
  CBB: { home: 4.0, away: -4.0 },      // Points (larger for college)
};

// Pace normalization factors
const PACE_NORMS = {
  NFL: { avgPossessions: 23 },
  NBA: { avgPossessions: 100 },
  CFB: { avgPlays: 70 },
  CBB: { avgPossessions: 68 },
};

interface TeamMetrics {
  offensiveEfficiency: number;
  defensiveEfficiency: number;
  pace: number;
  strengthOfSchedule: number;
}

interface ProjectionResult {
  projectedAwayScore: number;
  projectedHomeScore: number;
  projectedTotal: number;
  projectedMargin: number;
  fairSpread: number;
  fairTotal: number;
  expectedPossessions: number;
  volatilityScore: number;
  blendBreakdown: { homeAway: number; season: number; recent: number };
  sosAdjustment: number;
  drivers: string[];
}

// Blend stats based on split type
function blendTeamStats(
  homeStats: TeamStats | undefined,
  awayStats: TeamStats | undefined,
  seasonStats: TeamStats | undefined,
  recentStats: TeamStats | undefined,
  sport: string
): TeamMetrics {
  const weights = BLEND_WEIGHTS[sport as keyof typeof BLEND_WEIGHTS] || BLEND_WEIGHTS.NFL;
  
  // Default metrics if no stats available
  let offEff = 100;
  let defEff = 100;
  let pace = 68;
  let sos = 0;
  
  // Helper to get efficiency based on sport
  const getOffEff = (stats: TeamStats | undefined): number | null => {
    if (!stats) return null;
    if (sport === "NFL" || sport === "CFB") {
      return stats.offensivePPP || stats.yardsPerPlay ? (stats.offensivePPP || 0) * 7 : null;
    }
    return stats.offensiveRating || stats.offensivePPP;
  };
  
  const getDefEff = (stats: TeamStats | undefined): number | null => {
    if (!stats) return null;
    if (sport === "NFL" || sport === "CFB") {
      return stats.defensivePPP || stats.opponentYardsPerPlay ? (stats.defensivePPP || 0) * 7 : null;
    }
    return stats.defensiveRating || stats.defensivePPP;
  };
  
  const getPace = (stats: TeamStats | undefined): number | null => {
    if (!stats) return null;
    return stats.pace || stats.possessionsPerGame || stats.playsPerGame;
  };
  
  // Calculate weighted average
  const homeOffEff = getOffEff(homeStats || awayStats);
  const seasonOffEff = getOffEff(seasonStats);
  const recentOffEff = getOffEff(recentStats);
  
  if (homeOffEff !== null || seasonOffEff !== null || recentOffEff !== null) {
    let totalWeight = 0;
    let weightedSum = 0;
    
    if (homeOffEff !== null) {
      weightedSum += homeOffEff * weights.homeAway;
      totalWeight += weights.homeAway;
    }
    if (seasonOffEff !== null) {
      weightedSum += seasonOffEff * weights.season;
      totalWeight += weights.season;
    }
    if (recentOffEff !== null) {
      weightedSum += recentOffEff * weights.recent;
      totalWeight += weights.recent;
    }
    
    if (totalWeight > 0) {
      offEff = weightedSum / totalWeight;
    }
  }
  
  // Similar for defensive efficiency
  const homeDefEff = getDefEff(homeStats || awayStats);
  const seasonDefEff = getDefEff(seasonStats);
  const recentDefEff = getDefEff(recentStats);
  
  if (homeDefEff !== null || seasonDefEff !== null || recentDefEff !== null) {
    let totalWeight = 0;
    let weightedSum = 0;
    
    if (homeDefEff !== null) {
      weightedSum += homeDefEff * weights.homeAway;
      totalWeight += weights.homeAway;
    }
    if (seasonDefEff !== null) {
      weightedSum += seasonDefEff * weights.season;
      totalWeight += weights.season;
    }
    if (recentDefEff !== null) {
      weightedSum += recentDefEff * weights.recent;
      totalWeight += weights.recent;
    }
    
    if (totalWeight > 0) {
      defEff = weightedSum / totalWeight;
    }
  }
  
  // Pace calculation
  const homePace = getPace(homeStats || awayStats);
  const seasonPace = getPace(seasonStats);
  
  if (homePace !== null) pace = homePace;
  else if (seasonPace !== null) pace = seasonPace;
  
  // SoS
  sos = seasonStats?.strengthOfSchedule || 0;
  
  return {
    offensiveEfficiency: offEff,
    defensiveEfficiency: defEff,
    pace,
    strengthOfSchedule: sos,
  };
}

// Calculate expected possessions for the game
function calculateExpectedPossessions(
  awayPace: number,
  homePace: number,
  sport: string
): number {
  // Average the two team's pace
  const avgPace = (awayPace + homePace) / 2;
  
  // Apply venue adjustment (home teams often control pace slightly)
  const venueAdjustedPace = avgPace * 1.01; // 1% home tempo boost
  
  return venueAdjustedPace;
}

// Calculate projected scores
function calculateProjectedScores(
  awayOffEff: number,
  awayDefEff: number,
  homeOffEff: number,
  homeDefEff: number,
  expectedPossessions: number,
  sport: string,
  isNeutralSite: boolean
): { awayScore: number; homeScore: number } {
  const venueAdj = VENUE_ADJUSTMENTS[sport as keyof typeof VENUE_ADJUSTMENTS] || VENUE_ADJUSTMENTS.NFL;
  
  // Calculate expected points
  // Away team: their offense vs home defense, adjusted
  // Home team: their offense vs away defense, adjusted
  
  let awayScore: number;
  let homeScore: number;
  
  if (sport === "NFL" || sport === "CFB") {
    // Football: PPP-based calculation
    const awayPPP = (awayOffEff + homeDefEff) / 2 / 7; // Convert back to PPP
    const homePPP = (homeOffEff + awayDefEff) / 2 / 7;
    
    awayScore = awayPPP * expectedPossessions;
    homeScore = homePPP * expectedPossessions;
  } else {
    // Basketball: Rating-based calculation (points per 100 possessions)
    awayScore = ((awayOffEff + homeDefEff) / 2) * (expectedPossessions / 100);
    homeScore = ((homeOffEff + awayDefEff) / 2) * (expectedPossessions / 100);
  }
  
  // Apply venue adjustment (unless neutral site)
  if (!isNeutralSite) {
    awayScore += venueAdj.away / 2;
    homeScore += venueAdj.home / 2;
  }
  
  return { awayScore, homeScore };
}

// Calculate volatility score (0-100)
function calculateVolatility(
  awaySos: number,
  homeSos: number,
  marginDiff: number,
  sport: string
): number {
  let volatility = 50; // Base volatility
  
  // Higher SoS differential = more uncertainty
  const sosDiff = Math.abs(awaySos - homeSos);
  volatility += sosDiff * 5;
  
  // Closer games = more volatile
  if (Math.abs(marginDiff) < 3) volatility += 15;
  else if (Math.abs(marginDiff) < 7) volatility += 5;
  
  // Sport-specific adjustments
  if (sport === "CFB" || sport === "CBB") {
    volatility += 10; // College sports more volatile
  }
  
  return Math.min(100, Math.max(0, Math.round(volatility)));
}

// Main projection function
export function generateProjection(
  game: Game,
  awayTeamStats: {
    home?: TeamStats;
    away?: TeamStats;
    season?: TeamStats;
    recent?: TeamStats;
  },
  homeTeamStats: {
    home?: TeamStats;
    away?: TeamStats;
    season?: TeamStats;
    recent?: TeamStats;
  }
): ProjectionResult {
  const sport = game.sport;
  const weights = BLEND_WEIGHTS[sport as keyof typeof BLEND_WEIGHTS] || BLEND_WEIGHTS.NFL;
  
  // Blend stats for each team
  // Away team uses their "away" stats, home team uses their "home" stats
  const awayMetrics = blendTeamStats(
    awayTeamStats.away,
    undefined,
    awayTeamStats.season,
    awayTeamStats.recent,
    sport
  );
  
  const homeMetrics = blendTeamStats(
    homeTeamStats.home,
    undefined,
    homeTeamStats.season,
    homeTeamStats.recent,
    sport
  );
  
  // Calculate expected possessions
  const expectedPossessions = calculateExpectedPossessions(
    awayMetrics.pace,
    homeMetrics.pace,
    sport
  );
  
  // Calculate projected scores
  const { awayScore, homeScore } = calculateProjectedScores(
    awayMetrics.offensiveEfficiency,
    awayMetrics.defensiveEfficiency,
    homeMetrics.offensiveEfficiency,
    homeMetrics.defensiveEfficiency,
    expectedPossessions,
    sport,
    game.isNeutralSite || false
  );
  
  // Calculate SoS adjustment
  const sosDiff = homeMetrics.strengthOfSchedule - awayMetrics.strengthOfSchedule;
  const sosAdjustment = sosDiff * 0.5; // 0.5 point per SoS unit
  
  // Apply SoS adjustment
  const adjustedAwayScore = awayScore - (sosAdjustment / 2);
  const adjustedHomeScore = homeScore + (sosAdjustment / 2);
  
  // Calculate projections
  const projectedTotal = adjustedAwayScore + adjustedHomeScore;
  const projectedMargin = adjustedHomeScore - adjustedAwayScore;
  
  // Fair lines
  const fairSpread = -projectedMargin; // Spread from home perspective
  const fairTotal = projectedTotal;
  
  // Calculate volatility
  const volatilityScore = calculateVolatility(
    awayMetrics.strengthOfSchedule,
    homeMetrics.strengthOfSchedule,
    projectedMargin,
    sport
  );
  
  // Generate drivers (key factors)
  const drivers: string[] = [];
  
  if (Math.abs(awayMetrics.offensiveEfficiency - homeMetrics.offensiveEfficiency) > 5) {
    const betterOff = awayMetrics.offensiveEfficiency > homeMetrics.offensiveEfficiency 
      ? game.awayTeamName : game.homeTeamName;
    drivers.push(`${betterOff} has significant offensive efficiency advantage`);
  }
  
  if (Math.abs(awayMetrics.defensiveEfficiency - homeMetrics.defensiveEfficiency) > 5) {
    const betterDef = awayMetrics.defensiveEfficiency < homeMetrics.defensiveEfficiency 
      ? game.awayTeamName : game.homeTeamName;
    drivers.push(`${betterDef} has defensive edge`);
  }
  
  if (Math.abs(awayMetrics.pace - homeMetrics.pace) > 5) {
    const fasterTeam = awayMetrics.pace > homeMetrics.pace 
      ? game.awayTeamName : game.homeTeamName;
    drivers.push(`${fasterTeam} plays at a faster pace - tempo mismatch`);
  }
  
  if (Math.abs(sosAdjustment) > 1) {
    drivers.push(`SoS adjustment of ${sosAdjustment > 0 ? "+" : ""}${sosAdjustment.toFixed(1)} points applied`);
  }
  
  return {
    projectedAwayScore: Math.round(adjustedAwayScore * 10) / 10,
    projectedHomeScore: Math.round(adjustedHomeScore * 10) / 10,
    projectedTotal: Math.round(projectedTotal * 10) / 10,
    projectedMargin: Math.round(projectedMargin * 10) / 10,
    fairSpread: Math.round(fairSpread * 10) / 10,
    fairTotal: Math.round(fairTotal * 10) / 10,
    expectedPossessions: Math.round(expectedPossessions * 10) / 10,
    volatilityScore,
    blendBreakdown: weights,
    sosAdjustment: Math.round(sosAdjustment * 10) / 10,
    drivers,
  };
}

// Create projection record for database
export function createProjectionRecord(
  gameId: number,
  sport: string,
  result: ProjectionResult
): InsertProjection {
  return {
    gameId,
    algorithmVersion: ALGORITHM_VERSIONS[sport as keyof typeof ALGORITHM_VERSIONS] || "Unknown",
    projectedAwayScore: result.projectedAwayScore,
    projectedHomeScore: result.projectedHomeScore,
    projectedTotal: result.projectedTotal,
    projectedMargin: result.projectedMargin,
    fairSpread: result.fairSpread,
    fairTotal: result.fairTotal,
    fairMoneylineHome: spreadToMoneyline(result.fairSpread),
    fairMoneylineAway: spreadToMoneyline(-result.fairSpread),
    expectedPossessions: result.expectedPossessions,
    volatilityScore: result.volatilityScore,
    blendHomeAway: result.blendBreakdown.homeAway,
    blendSeason: result.blendBreakdown.season,
    blendRecent: result.blendBreakdown.recent,
    sosAdjustment: result.sosAdjustment,
    detailedMetrics: {},
    drivers: result.drivers,
  };
}

// Convert spread to moneyline
function spreadToMoneyline(spread: number): number {
  // Rough conversion: each point is worth ~40-50 in ML odds
  const absSpread = Math.abs(spread);
  
  if (absSpread < 1) return spread > 0 ? -110 : 110;
  if (absSpread < 3) return spread > 0 ? -130 : 110;
  if (absSpread < 5) return spread > 0 ? -160 : 135;
  if (absSpread < 7) return spread > 0 ? -200 : 170;
  if (absSpread < 10) return spread > 0 ? -280 : 230;
  return spread > 0 ? -400 : 320;
}

// Identify opportunities based on projection vs current lines
export function identifyOpportunities(
  gameId: number,
  sport: string,
  projection: ProjectionResult,
  currentSpread: number | null,
  currentTotal: number | null
): InsertOpportunity[] {
  const opportunities: InsertOpportunity[] = [];
  const minEdge = 3; // Minimum edge percentage to flag
  
  // Check spread opportunity
  if (currentSpread !== null) {
    const spreadEdge = projection.fairSpread - currentSpread;
    const spreadEdgePct = Math.abs(spreadEdge) / Math.abs(currentSpread || 1) * 100;
    
    if (Math.abs(spreadEdge) >= 1) {
      const side = spreadEdge > 0 ? "away" : "home";
      const confidence = getConfidence(Math.abs(spreadEdge), projection.volatilityScore);
      
      opportunities.push({
        gameId,
        projectionId: null,
        sport,
        marketType: "spread",
        side,
        playDescription: `${side === "home" ? "Home" : "Away"} ${currentSpread > 0 ? "+" : ""}${currentSpread}`,
        currentLine: currentSpread,
        currentOdds: -110,
        fairLine: projection.fairSpread,
        edgePercentage: Math.round(spreadEdgePct * 10) / 10,
        confidence,
        volatilityScore: projection.volatilityScore,
        isReverseLineMovement: false,
        ticketPercentage: null,
        moneyPercentage: null,
        drivers: projection.drivers,
        killSwitches: null,
        status: "active",
        result: null,
      });
    }
  }
  
  // Check total opportunity
  if (currentTotal !== null) {
    const totalEdge = projection.fairTotal - currentTotal;
    const totalEdgePct = Math.abs(totalEdge) / currentTotal * 100;
    
    if (Math.abs(totalEdge) >= 2) {
      const side = totalEdge > 0 ? "over" : "under";
      const confidence = getConfidence(Math.abs(totalEdge), projection.volatilityScore);
      
      opportunities.push({
        gameId,
        projectionId: null,
        sport,
        marketType: "total",
        side,
        playDescription: `${side === "over" ? "Over" : "Under"} ${currentTotal}`,
        currentLine: currentTotal,
        currentOdds: -110,
        fairLine: projection.fairTotal,
        edgePercentage: Math.round(totalEdgePct * 10) / 10,
        confidence,
        volatilityScore: projection.volatilityScore,
        isReverseLineMovement: false,
        ticketPercentage: null,
        moneyPercentage: null,
        drivers: projection.drivers,
        killSwitches: null,
        status: "active",
        result: null,
      });
    }
  }
  
  return opportunities;
}

function getConfidence(edge: number, volatility: number): string {
  // High confidence: large edge + low volatility
  if (edge >= 3 && volatility < 55) return "High";
  if (edge >= 2 && volatility < 65) return "Medium";
  return "Lean";
}
