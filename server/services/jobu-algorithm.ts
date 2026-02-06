import type {
  TeamStats,
  Game,
  InsertProjection,
  InsertOpportunity
} from "@shared/schema";

// Algorithm versions — bumped to reflect Four Factors + Opus methodology
export const ALGORITHM_VERSIONS = {
  NFL: "NFL v4.1R1",
  NBA: "NBA v4.0R1",
  CFB: "CFB v4.0R1",
  CBB: "CBB v4.0R1",
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
  NFL: { home: 2.5, away: -2.5 },
  NBA: { home: 3.0, away: -3.0 },
  CFB: { home: 3.0, away: -3.0 },
  CBB: { home: 4.0, away: -4.0 },
};

// Pace normalization factors
const PACE_NORMS = {
  NFL: { avgPossessions: 23 },
  NBA: { avgPossessions: 100 },
  CFB: { avgPlays: 70 },
  CBB: { avgPossessions: 68 },
};

// Four Factors weights by importance (basketball only)
// Based on Dean Oliver's research: eFG% is most predictive
const FOUR_FACTORS_WEIGHTS = {
  effectiveFieldGoalPct: 0.40,
  turnoverPct: 0.25,
  offensiveReboundPct: 0.14,
  freeThrowRate: 0.15,
  // remaining 0.06 is covered by pace/other
};

// League averages for Four Factors (used to calculate deviation)
const LEAGUE_AVERAGES = {
  NBA: {
    effectiveFieldGoalPct: 54.0,
    turnoverPct: 13.5,
    offensiveReboundPct: 25.5,
    freeThrowRate: 27.0,
    pace: 100,
    offRating: 114,
    defRating: 114,
  },
  CBB: {
    effectiveFieldGoalPct: 50.0,
    turnoverPct: 17.5,
    offensiveReboundPct: 28.0,
    freeThrowRate: 32.0,
    pace: 68,
    offRating: 105,
    defRating: 105,
  },
};

// Rest/travel adjustments
const REST_ADJUSTMENTS = {
  NBA: {
    backToBack: -3.0,        // B2B team loses ~3 points
    backToBackAway: -4.5,    // B2B + road is worse
    threeInFour: -1.5,       // 3 games in 4 nights
    extraRest: 1.0,          // 2+ days off = slight boost
  },
  CBB: {
    backToBack: -2.0,
    backToBackAway: -3.0,
    threeInFour: -1.0,
    extraRest: 0.5,
  },
  NFL: { backToBack: 0, backToBackAway: 0, threeInFour: 0, extraRest: 0 },
  CFB: { backToBack: 0, backToBackAway: 0, threeInFour: 0, extraRest: 0 },
};

// 1H projection ratios by sport
const FIRST_HALF_RATIOS = {
  NBA: { totalPct: 0.485, spreadPct: 0.47 },   // 1H ≈ 48.5% of total, 47% of spread
  CBB: { totalPct: 0.48, spreadPct: 0.46 },
  NFL: { totalPct: 0.47, spreadPct: 0.45 },
  CFB: { totalPct: 0.47, spreadPct: 0.45 },
};

interface TeamMetrics {
  offensiveEfficiency: number;
  defensiveEfficiency: number;
  pace: number;
  strengthOfSchedule: number;
  // Four Factors (offensive)
  effectiveFieldGoalPct: number | null;
  turnoverPct: number | null;
  offensiveReboundPct: number | null;
  freeThrowRate: number | null;
  // Opponent Four Factors (defensive proxy)
  oppEffectiveFieldGoalPct: number | null;
  oppTurnoverPct: number | null;
  oppFreeThrowRate: number | null;
  // Shooting
  threePointPct: number | null;
  threePointRate: number | null;
}

interface FourFactorsEdge {
  totalEdge: number;        // Combined Four Factors edge in points
  efgEdge: number;
  tovEdge: number;
  orbEdge: number;
  ftRateEdge: number;
  drivers: string[];
}

export interface ProjectionResult {
  projectedAwayScore: number;
  projectedHomeScore: number;
  projectedTotal: number;
  projectedMargin: number;
  fairSpread: number;
  fairTotal: number;
  expectedPossessions: number;
  volatilityScore: number;
  volatilityDrivers: string[];
  blendBreakdown: { homeAway: number; season: number; recent: number };
  sosAdjustment: number;
  fourFactorsEdge: FourFactorsEdge | null;
  restAdjustment: { home: number; away: number; drivers: string[] };
  paceClashAdjustment: number;
  drivers: string[];
  killSwitches: string[];
  // First-half projections
  firstHalf: {
    fairSpread: number;
    fairTotal: number;
    projectedAwayScore: number;
    projectedHomeScore: number;
  };
}

// Sport-specific default metrics when no stats available
const DEFAULT_METRICS = {
  NFL: { offEff: 21, defEff: 21, pace: 23 },
  NBA: { offEff: 114, defEff: 114, pace: 100 },
  CFB: { offEff: 28, defEff: 28, pace: 70 },
  CBB: { offEff: 105, defEff: 105, pace: 68 },
};

// Blend stats based on split type
function blendTeamStats(
  homeStats: TeamStats | undefined,
  awayStats: TeamStats | undefined,
  seasonStats: TeamStats | undefined,
  recentStats: TeamStats | undefined,
  sport: string
): TeamMetrics {
  const weights = BLEND_WEIGHTS[sport as keyof typeof BLEND_WEIGHTS] || BLEND_WEIGHTS.NFL;
  const defaults = DEFAULT_METRICS[sport as keyof typeof DEFAULT_METRICS] || DEFAULT_METRICS.NFL;

  let offEff = defaults.offEff;
  let defEff = defaults.defEff;
  let pace = defaults.pace;
  let sos = 0;

  const normalizeBasketballRating = (val: number): number => {
    return val < 2 ? val * 100 : val;
  };

  const getOffEff = (stats: TeamStats | undefined): number | null => {
    if (!stats) return null;
    if (sport === "NFL" || sport === "CFB") {
      return stats.offensivePPP || stats.yardsPerPlay ? (stats.offensivePPP || 0) * 7 : null;
    }
    const rating = stats.offensiveRating || stats.offensivePPP;
    return rating ? normalizeBasketballRating(rating) : null;
  };

  const getDefEff = (stats: TeamStats | undefined): number | null => {
    if (!stats) return null;
    if (sport === "NFL" || sport === "CFB") {
      return stats.defensivePPP || stats.opponentYardsPerPlay ? (stats.defensivePPP || 0) * 7 : null;
    }
    const rating = stats.defensiveRating || stats.defensivePPP;
    return rating ? normalizeBasketballRating(rating) : null;
  };

  const getPace = (stats: TeamStats | undefined): number | null => {
    if (!stats) return null;
    return stats.pace || stats.possessionsPerGame || stats.playsPerGame;
  };

  // Calculate weighted average for offensive efficiency
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

  // Defensive efficiency
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

  // Extract Four Factors from best available source (prefer split-specific, fallback to season)
  const bestStats = homeStats || awayStats || seasonStats;

  return {
    offensiveEfficiency: offEff,
    defensiveEfficiency: defEff,
    pace,
    strengthOfSchedule: sos,
    effectiveFieldGoalPct: bestStats?.effectiveFieldGoalPct ?? seasonStats?.effectiveFieldGoalPct ?? null,
    turnoverPct: bestStats?.turnoverPct ?? seasonStats?.turnoverPct ?? null,
    offensiveReboundPct: bestStats?.offensiveReboundPct ?? seasonStats?.offensiveReboundPct ?? null,
    freeThrowRate: bestStats?.freeThrowRate ?? seasonStats?.freeThrowRate ?? null,
    // For opponent factors, we use the rawData if available, otherwise null
    oppEffectiveFieldGoalPct: null, // Will be set from opponent's defensive stats
    oppTurnoverPct: null,
    oppFreeThrowRate: null,
    threePointPct: bestStats?.threePointPct ?? seasonStats?.threePointPct ?? null,
    threePointRate: bestStats?.threePointRate ?? seasonStats?.threePointRate ?? null,
  };
}

// Calculate expected possessions with pace-clash logic
function calculateExpectedPossessions(
  awayPace: number,
  homePace: number,
  sport: string
): { possessions: number; paceClash: number; driver: string | null } {
  const avgPace = (awayPace + homePace) / 2;
  const norms = PACE_NORMS[sport as keyof typeof PACE_NORMS] || PACE_NORMS.NFL;
  const leagueAvg = sport === "NFL" || sport === "CFB"
    ? norms.avgPossessions || norms.avgPlays || 70
    : norms.avgPossessions || 100;

  // Pace-clash: slow team controls tempo more (60/40 split per Opus methodology)
  const paceDiff = Math.abs(awayPace - homePace);
  let paceClash = 0;
  let driver: string | null = null;

  if (paceDiff > 3 && (sport === "NBA" || sport === "CBB")) {
    const slowerPace = Math.min(awayPace, homePace);
    const fasterPace = Math.max(awayPace, homePace);
    // Slow team controls tempo ~60% per Opus methodology
    const adjustedPace = slowerPace * 0.6 + fasterPace * 0.4;
    paceClash = adjustedPace - avgPace;

    const slowerTeam = awayPace < homePace ? "away" : "home";
    driver = `Pace clash: ${paceDiff.toFixed(1)} poss diff — ${slowerTeam} team controls tempo (${slowerPace.toFixed(0)} vs ${fasterPace.toFixed(0)})`;

    // Apply venue adjustment (home teams control pace slightly more)
    const venueAdjustedPace = adjustedPace * 1.005;
    return { possessions: venueAdjustedPace, paceClash, driver };
  }

  // Standard: simple average with slight home tempo boost
  const venueAdjustedPace = avgPace * 1.01;
  return { possessions: venueAdjustedPace, paceClash: 0, driver: null };
}

// Four Factors analysis (basketball only)
function analyzeFourFactors(
  awayMetrics: TeamMetrics,
  homeMetrics: TeamMetrics,
  sport: string
): FourFactorsEdge | null {
  if (sport !== "NBA" && sport !== "CBB") return null;

  const leagueAvg = LEAGUE_AVERAGES[sport as keyof typeof LEAGUE_AVERAGES];
  if (!leagueAvg) return null;

  // Need at least eFG% for either team to run Four Factors
  if (!awayMetrics.effectiveFieldGoalPct && !homeMetrics.effectiveFieldGoalPct) return null;

  const drivers: string[] = [];
  let efgEdge = 0;
  let tovEdge = 0;
  let orbEdge = 0;
  let ftRateEdge = 0;

  // eFG% edge: compare each team's offensive eFG% vs opponent's defensive ability
  if (awayMetrics.effectiveFieldGoalPct && homeMetrics.effectiveFieldGoalPct) {
    const awayEfgDev = awayMetrics.effectiveFieldGoalPct - leagueAvg.effectiveFieldGoalPct;
    const homeEfgDev = homeMetrics.effectiveFieldGoalPct - leagueAvg.effectiveFieldGoalPct;
    // Each % of eFG% above average ≈ 1.2 points per game impact
    efgEdge = (homeEfgDev - awayEfgDev) * 1.2 * FOUR_FACTORS_WEIGHTS.effectiveFieldGoalPct;

    if (Math.abs(homeMetrics.effectiveFieldGoalPct - awayMetrics.effectiveFieldGoalPct) > 2.0) {
      const better = homeMetrics.effectiveFieldGoalPct > awayMetrics.effectiveFieldGoalPct ? "Home" : "Away";
      drivers.push(`${better} eFG% edge: ${homeMetrics.effectiveFieldGoalPct.toFixed(1)}% vs ${awayMetrics.effectiveFieldGoalPct.toFixed(1)}%`);
    }
  }

  // TOV% edge: lower is better for offense
  if (awayMetrics.turnoverPct && homeMetrics.turnoverPct) {
    const awayTovDev = awayMetrics.turnoverPct - leagueAvg.turnoverPct;
    const homeTovDev = homeMetrics.turnoverPct - leagueAvg.turnoverPct;
    // Each % of TOV% below average ≈ 0.8 points per game
    // Note: lower TOV% is better, so we flip the sign
    tovEdge = (awayTovDev - homeTovDev) * 0.8 * FOUR_FACTORS_WEIGHTS.turnoverPct;

    if (Math.abs(homeMetrics.turnoverPct - awayMetrics.turnoverPct) > 2.0) {
      const better = homeMetrics.turnoverPct < awayMetrics.turnoverPct ? "Home" : "Away";
      drivers.push(`${better} turnover edge: ${homeMetrics.turnoverPct.toFixed(1)}% vs ${awayMetrics.turnoverPct.toFixed(1)}%`);
    }
  }

  // ORB% edge
  if (awayMetrics.offensiveReboundPct && homeMetrics.offensiveReboundPct) {
    const awayOrbDev = awayMetrics.offensiveReboundPct - leagueAvg.offensiveReboundPct;
    const homeOrbDev = homeMetrics.offensiveReboundPct - leagueAvg.offensiveReboundPct;
    orbEdge = (homeOrbDev - awayOrbDev) * 0.5 * FOUR_FACTORS_WEIGHTS.offensiveReboundPct;

    if (Math.abs(homeMetrics.offensiveReboundPct - awayMetrics.offensiveReboundPct) > 3.0) {
      const better = homeMetrics.offensiveReboundPct > awayMetrics.offensiveReboundPct ? "Home" : "Away";
      drivers.push(`${better} rebounding edge: ${homeMetrics.offensiveReboundPct.toFixed(1)}% vs ${awayMetrics.offensiveReboundPct.toFixed(1)}%`);
    }
  }

  // FTr (Free Throw Rate) edge
  if (awayMetrics.freeThrowRate && homeMetrics.freeThrowRate) {
    const awayFtDev = awayMetrics.freeThrowRate - leagueAvg.freeThrowRate;
    const homeFtDev = homeMetrics.freeThrowRate - leagueAvg.freeThrowRate;
    ftRateEdge = (homeFtDev - awayFtDev) * 0.3 * FOUR_FACTORS_WEIGHTS.freeThrowRate;

    if (Math.abs(homeMetrics.freeThrowRate - awayMetrics.freeThrowRate) > 5.0) {
      const better = homeMetrics.freeThrowRate > awayMetrics.freeThrowRate ? "Home" : "Away";
      drivers.push(`${better} FT rate edge: ${homeMetrics.freeThrowRate.toFixed(1)} vs ${awayMetrics.freeThrowRate.toFixed(1)}`);
    }
  }

  const totalEdge = efgEdge + tovEdge + orbEdge + ftRateEdge;

  return {
    totalEdge: Math.round(totalEdge * 10) / 10,
    efgEdge: Math.round(efgEdge * 10) / 10,
    tovEdge: Math.round(tovEdge * 10) / 10,
    orbEdge: Math.round(orbEdge * 10) / 10,
    ftRateEdge: Math.round(ftRateEdge * 10) / 10,
    drivers,
  };
}

// Calculate rest/travel adjustment
function calculateRestAdjustment(
  sport: string,
  homeRestDays: number | null,
  awayRestDays: number | null,
  isAwayTeamTraveling: boolean
): { home: number; away: number; drivers: string[] } {
  const restConfig = REST_ADJUSTMENTS[sport as keyof typeof REST_ADJUSTMENTS] || REST_ADJUSTMENTS.NFL;
  let homeAdj = 0;
  let awayAdj = 0;
  const drivers: string[] = [];

  // Home team rest
  if (homeRestDays !== null) {
    if (homeRestDays === 0) {
      homeAdj += restConfig.backToBack;
      drivers.push(`Home team on back-to-back (${restConfig.backToBack} pts)`);
    } else if (homeRestDays >= 2) {
      homeAdj += restConfig.extraRest;
      if (restConfig.extraRest !== 0) {
        drivers.push(`Home team extra rest: ${homeRestDays} days off (+${restConfig.extraRest} pts)`);
      }
    }
  }

  // Away team rest
  if (awayRestDays !== null) {
    if (awayRestDays === 0 && isAwayTeamTraveling) {
      awayAdj += restConfig.backToBackAway;
      drivers.push(`Away team B2B + travel (${restConfig.backToBackAway} pts)`);
    } else if (awayRestDays === 0) {
      awayAdj += restConfig.backToBack;
      drivers.push(`Away team on back-to-back (${restConfig.backToBack} pts)`);
    } else if (awayRestDays >= 2) {
      awayAdj += restConfig.extraRest;
      if (restConfig.extraRest !== 0) {
        drivers.push(`Away team extra rest: ${awayRestDays} days off (+${restConfig.extraRest} pts)`);
      }
    }
  }

  return { home: homeAdj, away: awayAdj, drivers };
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

  let awayScore: number;
  let homeScore: number;

  if (sport === "NFL" || sport === "CFB") {
    const awayPPP = (awayOffEff + homeDefEff) / 2 / 7;
    const homePPP = (homeOffEff + awayDefEff) / 2 / 7;

    awayScore = awayPPP * expectedPossessions;
    homeScore = homePPP * expectedPossessions;
  } else {
    awayScore = ((awayOffEff + homeDefEff) / 2) * (expectedPossessions / 100);
    homeScore = ((homeOffEff + awayDefEff) / 2) * (expectedPossessions / 100);
  }

  if (!isNeutralSite) {
    awayScore += venueAdj.away / 2;
    homeScore += venueAdj.home / 2;
  }

  return { awayScore, homeScore };
}

// Enhanced volatility score (0-100) with specific drivers
function calculateVolatility(
  awayMetrics: TeamMetrics,
  homeMetrics: TeamMetrics,
  marginDiff: number,
  sport: string,
  fourFactorsEdge: FourFactorsEdge | null,
  restAdj: { home: number; away: number }
): { score: number; drivers: string[] } {
  let volatility = 45; // Start slightly below midpoint
  const drivers: string[] = [];

  // SoS differential = more uncertainty
  const sosDiff = Math.abs(awayMetrics.strengthOfSchedule - homeMetrics.strengthOfSchedule);
  if (sosDiff > 2) {
    const sosPenalty = Math.min(15, sosDiff * 4);
    volatility += sosPenalty;
    drivers.push(`SoS mismatch: ${sosDiff.toFixed(1)} difference`);
  }

  // Closer games = more volatile
  if (Math.abs(marginDiff) < 2) {
    volatility += 18;
    drivers.push("Near pick'em game — high variance");
  } else if (Math.abs(marginDiff) < 4) {
    volatility += 10;
    drivers.push("Tight projected margin");
  } else if (Math.abs(marginDiff) < 7) {
    volatility += 3;
  }

  // Sport-specific adjustments
  if (sport === "CFB" || sport === "CBB") {
    volatility += 8;
    drivers.push("College sport: higher variance baseline");
  }

  // Pace mismatch adds volatility
  const paceDiff = Math.abs(awayMetrics.pace - homeMetrics.pace);
  if (paceDiff > 5 && (sport === "NBA" || sport === "CBB")) {
    volatility += Math.min(10, paceDiff * 1.5);
    drivers.push(`Pace mismatch: ${paceDiff.toFixed(0)} possessions apart`);
  }

  // Four Factors disagreeing with efficiency adds uncertainty
  if (fourFactorsEdge && Math.abs(fourFactorsEdge.totalEdge) > 2) {
    // If 4F edge goes opposite direction from efficiency edge, add volatility
    if ((fourFactorsEdge.totalEdge > 0 && marginDiff < 0) ||
        (fourFactorsEdge.totalEdge < 0 && marginDiff > 0)) {
      volatility += 8;
      drivers.push("Four Factors and efficiency disagree — conflicting signals");
    }
  }

  // Rest issues add volatility
  if (Math.abs(restAdj.home) >= 3 || Math.abs(restAdj.away) >= 3) {
    volatility += 5;
    drivers.push("Back-to-back in play — fatigue adds variance");
  }

  // Missing data = more uncertainty
  const hasHomeFourFactors = homeMetrics.effectiveFieldGoalPct !== null;
  const hasAwayFourFactors = awayMetrics.effectiveFieldGoalPct !== null;
  if (!hasHomeFourFactors || !hasAwayFourFactors) {
    volatility += 5;
    drivers.push("Incomplete Four Factors data");
  }

  // Low volatility bonus: large efficiency gap + Four Factors agreement
  if (Math.abs(marginDiff) > 8 && fourFactorsEdge &&
      Math.sign(fourFactorsEdge.totalEdge) === Math.sign(marginDiff)) {
    volatility -= 8;
    drivers.push("Large edge + Four Factors alignment — lower variance");
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(volatility)));
  return { score: finalScore, drivers };
}

// Generate kill switches — conditions that should downgrade or void a play
function generateKillSwitches(
  sport: string,
  volatilityScore: number,
  edge: number,
  fourFactorsEdge: FourFactorsEdge | null,
  restAdj: { home: number; away: number },
  awayMetrics: TeamMetrics,
  homeMetrics: TeamMetrics
): string[] {
  const kills: string[] = [];

  // Volatility too high for the edge size
  if (volatilityScore > 70 && edge < 3) {
    kills.push("High volatility with small edge — consider passing");
  }

  // Four Factors oppose the play direction
  if (fourFactorsEdge && Math.abs(fourFactorsEdge.totalEdge) > 1.5) {
    // This would need context of which side the play is on
    // For now, flag when four factors and efficiency disagree significantly
    kills.push("Four Factors divergence detected — verify play direction");
  }

  // Severe rest disadvantage
  if (Math.abs(restAdj.home - restAdj.away) > 4) {
    kills.push("Major rest disparity — factor heavily into decision");
  }

  // Missing critical data
  if (!awayMetrics.effectiveFieldGoalPct && !homeMetrics.effectiveFieldGoalPct) {
    kills.push("No Four Factors data — projection based solely on efficiency ratings");
  }

  return kills;
}

// Main projection function — enhanced with Opus methodology
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
  },
  options?: {
    homeRestDays?: number | null;
    awayRestDays?: number | null;
    isAwayTeamTraveling?: boolean;
  }
): ProjectionResult {
  const sport = game.sport;
  const weights = BLEND_WEIGHTS[sport as keyof typeof BLEND_WEIGHTS] || BLEND_WEIGHTS.NFL;

  // Blend stats for each team
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

  // Calculate expected possessions with pace-clash adjustment
  const paceResult = calculateExpectedPossessions(
    awayMetrics.pace,
    homeMetrics.pace,
    sport
  );

  // Calculate base projected scores
  const { awayScore: baseAwayScore, homeScore: baseHomeScore } = calculateProjectedScores(
    awayMetrics.offensiveEfficiency,
    awayMetrics.defensiveEfficiency,
    homeMetrics.offensiveEfficiency,
    homeMetrics.defensiveEfficiency,
    paceResult.possessions,
    sport,
    game.isNeutralSite || false
  );

  // Four Factors analysis (basketball only)
  const fourFactorsEdge = analyzeFourFactors(awayMetrics, homeMetrics, sport);

  // Rest/travel adjustment
  const restAdj = calculateRestAdjustment(
    sport,
    options?.homeRestDays ?? null,
    options?.awayRestDays ?? null,
    options?.isAwayTeamTraveling ?? true // default: away team is traveling
  );

  // SoS adjustment
  const sosDiff = homeMetrics.strengthOfSchedule - awayMetrics.strengthOfSchedule;
  const sosAdjustment = sosDiff * 0.5;

  // Apply all adjustments to scores
  let adjustedAwayScore = baseAwayScore - (sosAdjustment / 2);
  let adjustedHomeScore = baseHomeScore + (sosAdjustment / 2);

  // Apply Four Factors edge (split between home/away)
  if (fourFactorsEdge) {
    adjustedHomeScore += fourFactorsEdge.totalEdge / 2;
    adjustedAwayScore -= fourFactorsEdge.totalEdge / 2;
  }

  // Apply rest adjustment
  adjustedHomeScore += restAdj.home;
  adjustedAwayScore += restAdj.away;

  // Calculate final projections
  const projectedTotal = adjustedAwayScore + adjustedHomeScore;
  const projectedMargin = adjustedHomeScore - adjustedAwayScore;

  // Fair lines
  const fairSpread = -projectedMargin;
  const fairTotal = projectedTotal;

  // Enhanced volatility
  const volatilityResult = calculateVolatility(
    awayMetrics,
    homeMetrics,
    projectedMargin,
    sport,
    fourFactorsEdge,
    restAdj
  );

  // Kill switches
  const killSwitches = generateKillSwitches(
    sport,
    volatilityResult.score,
    Math.abs(projectedMargin),
    fourFactorsEdge,
    restAdj,
    awayMetrics,
    homeMetrics
  );

  // Generate drivers
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

  if (paceResult.driver) {
    drivers.push(paceResult.driver);
  }

  if (Math.abs(sosAdjustment) > 1) {
    drivers.push(`SoS adjustment of ${sosAdjustment > 0 ? "+" : ""}${sosAdjustment.toFixed(1)} points`);
  }

  // Add Four Factors drivers
  if (fourFactorsEdge) {
    drivers.push(...fourFactorsEdge.drivers);
    if (Math.abs(fourFactorsEdge.totalEdge) > 1) {
      drivers.push(`Four Factors net edge: ${fourFactorsEdge.totalEdge > 0 ? "+" : ""}${fourFactorsEdge.totalEdge.toFixed(1)} pts (Home)`);
    }
  }

  // Add rest drivers
  drivers.push(...restAdj.drivers);

  // Three-point shooting edge
  if (awayMetrics.threePointPct && homeMetrics.threePointPct) {
    const diff = Math.abs(awayMetrics.threePointPct - homeMetrics.threePointPct);
    if (diff > 3) {
      const better = awayMetrics.threePointPct > homeMetrics.threePointPct
        ? game.awayTeamName : game.homeTeamName;
      drivers.push(`${better} 3PT edge: ${Math.max(awayMetrics.threePointPct, homeMetrics.threePointPct).toFixed(1)}% vs ${Math.min(awayMetrics.threePointPct, homeMetrics.threePointPct).toFixed(1)}%`);
    }
  }

  // First-half projections
  const fhRatios = FIRST_HALF_RATIOS[sport as keyof typeof FIRST_HALF_RATIOS] || FIRST_HALF_RATIOS.NBA;
  const fhTotal = fairTotal * fhRatios.totalPct;
  const fhSpread = fairSpread * fhRatios.spreadPct;
  const fhAwayScore = adjustedAwayScore * fhRatios.totalPct;
  const fhHomeScore = adjustedHomeScore * fhRatios.totalPct;

  return {
    projectedAwayScore: Math.round(adjustedAwayScore * 10) / 10,
    projectedHomeScore: Math.round(adjustedHomeScore * 10) / 10,
    projectedTotal: Math.round(projectedTotal * 10) / 10,
    projectedMargin: Math.round(projectedMargin * 10) / 10,
    fairSpread: Math.round(fairSpread * 10) / 10,
    fairTotal: Math.round(fairTotal * 10) / 10,
    expectedPossessions: Math.round(paceResult.possessions * 10) / 10,
    volatilityScore: volatilityResult.score,
    volatilityDrivers: volatilityResult.drivers,
    blendBreakdown: weights,
    sosAdjustment: Math.round(sosAdjustment * 10) / 10,
    fourFactorsEdge,
    restAdjustment: restAdj,
    paceClashAdjustment: Math.round(paceResult.paceClash * 10) / 10,
    drivers,
    killSwitches,
    firstHalf: {
      fairSpread: Math.round(fhSpread * 10) / 10,
      fairTotal: Math.round(fhTotal * 10) / 10,
      projectedAwayScore: Math.round(fhAwayScore * 10) / 10,
      projectedHomeScore: Math.round(fhHomeScore * 10) / 10,
    },
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
    detailedMetrics: {
      fourFactorsEdge: result.fourFactorsEdge,
      restAdjustment: result.restAdjustment,
      paceClashAdjustment: result.paceClashAdjustment,
      volatilityDrivers: result.volatilityDrivers,
      killSwitches: result.killSwitches,
      firstHalf: result.firstHalf,
    },
    drivers: result.drivers,
  };
}

// Convert spread to moneyline
function spreadToMoneyline(spread: number): number {
  const absSpread = Math.abs(spread);

  if (absSpread < 1) return spread > 0 ? -110 : 110;
  if (absSpread < 3) return spread > 0 ? -130 : 110;
  if (absSpread < 5) return spread > 0 ? -160 : 135;
  if (absSpread < 7) return spread > 0 ? -200 : 170;
  if (absSpread < 10) return spread > 0 ? -280 : 230;
  return spread > 0 ? -400 : 320;
}

// Enhanced confidence determination per Opus methodology
// Strong = high edge + low volatility + Four Factors alignment
// Medium = solid edge + manageable volatility
// Lean = small edge or high volatility
function getConfidenceEnhanced(
  edgePct: number,
  volatility: number,
  fourFactorsEdge: FourFactorsEdge | null,
  killSwitchCount: number,
  sport: string
): string {
  // Kill switches degrade confidence
  if (killSwitchCount >= 2) return "Lean";

  // Stricter thresholds per Opus methodology
  if (sport === "NBA" || sport === "CBB") {
    // Basketball: need higher edge due to variance
    if (edgePct >= 4.5 && volatility < 50 && killSwitchCount === 0) {
      // Four Factors alignment bonus
      if (fourFactorsEdge && Math.abs(fourFactorsEdge.totalEdge) > 1) {
        return "High";
      }
      return edgePct >= 5.5 ? "High" : "Medium";
    }
    if (edgePct >= 3.0 && volatility < 60) return "Medium";
    if (edgePct >= 2.0) return "Lean";
    return "Lean";
  }

  // Football
  if (edgePct >= 4.0 && volatility < 55 && killSwitchCount === 0) return "High";
  if (edgePct >= 2.5 && volatility < 65) return "Medium";
  return "Lean";
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

  // Check spread opportunity
  if (currentSpread !== null) {
    const spreadEdge = projection.fairSpread - currentSpread;
    const spreadEdgePct = Math.abs(spreadEdge) / Math.abs(currentSpread || 1) * 100;

    if (Math.abs(spreadEdge) >= 1) {
      const side = spreadEdge > 0 ? "away" : "home";
      const confidence = getConfidenceEnhanced(
        spreadEdgePct,
        projection.volatilityScore,
        projection.fourFactorsEdge,
        projection.killSwitches.length,
        sport
      );

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
        killSwitches: projection.killSwitches.length > 0 ? projection.killSwitches : null,
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
      const confidence = getConfidenceEnhanced(
        totalEdgePct,
        projection.volatilityScore,
        projection.fourFactorsEdge,
        projection.killSwitches.length,
        sport
      );

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
        killSwitches: projection.killSwitches.length > 0 ? projection.killSwitches : null,
        status: "active",
        result: null,
      });
    }
  }

  // Check first-half spread opportunity
  if (currentSpread !== null) {
    const fhMarketSpread = currentSpread * (FIRST_HALF_RATIOS[sport as keyof typeof FIRST_HALF_RATIOS]?.spreadPct || 0.47);
    const fhEdge = projection.firstHalf.fairSpread - fhMarketSpread;
    const fhEdgePct = Math.abs(fhEdge) / Math.abs(fhMarketSpread || 1) * 100;

    // 1H needs a larger edge to play (more variance in half-game samples)
    if (Math.abs(fhEdge) >= 1.5 && fhEdgePct >= 3) {
      const side = fhEdge > 0 ? "away" : "home";
      const confidence = getConfidenceEnhanced(
        fhEdgePct,
        projection.volatilityScore + 5, // 1H inherently more volatile
        projection.fourFactorsEdge,
        projection.killSwitches.length,
        sport
      );

      opportunities.push({
        gameId,
        projectionId: null,
        sport,
        marketType: "1h",
        side,
        playDescription: `1H ${side === "home" ? "Home" : "Away"} ${fhMarketSpread > 0 ? "+" : ""}${Math.round(fhMarketSpread * 10) / 10}`,
        currentLine: Math.round(fhMarketSpread * 10) / 10,
        currentOdds: -110,
        fairLine: projection.firstHalf.fairSpread,
        edgePercentage: Math.round(fhEdgePct * 10) / 10,
        confidence,
        volatilityScore: projection.volatilityScore + 5,
        isReverseLineMovement: false,
        ticketPercentage: null,
        moneyPercentage: null,
        drivers: [...projection.drivers, "First-half play derived from full-game projection"],
        killSwitches: projection.killSwitches.length > 0 ? projection.killSwitches : null,
        status: "active",
        result: null,
      });
    }
  }

  return opportunities;
}

// Export getConfidenceEnhanced for use in pipeline
export { getConfidenceEnhanced };
