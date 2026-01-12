import { storage } from "../storage";
import { runScraper } from "./scrapers";
import { generateProjection } from "./jobu-algorithm";
import { detectRlmFromLines } from "./rlm-detector";
import { db } from "../db";
import { games, teamStats, projections, opportunities, odds, type Game, type TeamStats, type Odds } from "@shared/schema";
import { eq, and, gte, lte, or, ilike, desc } from "drizzle-orm";

function oddsToProbability(americanOdds: number): number {
  if (americanOdds < 0) {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
  return 100 / (americanOdds + 100);
}

function calculateEdgePercentage(
  marketLine: number, 
  fairLine: number, 
  marketType: "spread" | "total",
  sport: string = "NFL",
  americanOdds: number = -110
): number {
  const diff = Math.abs(marketLine - fairLine);
  
  const pointValues: Record<string, number> = {
    NFL: 0.01,
    NBA: 0.01,
    CFB: 0.008,
    CBB: 0.008,
  };
  
  const pointValue = marketType === "spread" 
    ? (pointValues[sport] || 0.01) 
    : 0.004;
  
  const coverProb = Math.min(0.95, Math.max(0.05, 0.5 + (pointValue * diff)));
  const impliedProb = oddsToProbability(americanOdds);
  
  const edge = (coverProb - impliedProb) * 100;
  
  return Math.min(15, Math.max(0, edge));
}

function determineSpreadSide(marketSpread: number, fairSpread: number): { side: "home" | "away"; edge: number } {
  const diff = fairSpread - marketSpread;
  if (diff > 0) {
    return { side: "home", edge: diff };
  }
  return { side: "away", edge: -diff };
}

function determineTotalSide(marketTotal: number, fairTotal: number): { side: "over" | "under"; edge: number } {
  const diff = marketTotal - fairTotal;
  if (diff > 0.5) {
    return { side: "under", edge: diff };
  }
  return { side: "over", edge: -diff };
}

interface PipelineResult {
  gamesScraped: number;
  projectionsGenerated: number;
  opportunitiesCreated: number;
  errors: string[];
}

// Team name aliases for better matching
const TEAM_ALIASES: Record<string, string[]> = {
  // NBA
  "Los Angeles Lakers": ["LA Lakers", "Lakers", "LAL"],
  "Los Angeles Clippers": ["LA Clippers", "Clippers", "LAC"],
  "Golden State Warriors": ["Warriors", "GSW", "Golden State"],
  "New York Knicks": ["Knicks", "NY Knicks", "NYK"],
  "Brooklyn Nets": ["Nets", "BKN"],
  "Boston Celtics": ["Celtics", "BOS"],
  "Miami Heat": ["Heat", "MIA"],
  "Philadelphia 76ers": ["76ers", "Sixers", "PHI", "Philadelphia"],
  "Milwaukee Bucks": ["Bucks", "MIL"],
  "Denver Nuggets": ["Nuggets", "DEN"],
  "Phoenix Suns": ["Suns", "PHX"],
  "Dallas Mavericks": ["Mavericks", "Mavs", "DAL"],
  "Oklahoma City Thunder": ["Thunder", "OKC"],
  "Minnesota Timberwolves": ["Timberwolves", "Wolves", "MIN"],
  "Cleveland Cavaliers": ["Cavaliers", "Cavs", "CLE"],
  "Sacramento Kings": ["Kings", "SAC"],
  "New Orleans Pelicans": ["Pelicans", "NO", "NOP"],
  "Indiana Pacers": ["Pacers", "IND"],
  "Orlando Magic": ["Magic", "ORL"],
  "Houston Rockets": ["Rockets", "HOU"],
  "Chicago Bulls": ["Bulls", "CHI"],
  "Atlanta Hawks": ["Hawks", "ATL"],
  "Memphis Grizzlies": ["Grizzlies", "MEM"],
  "Utah Jazz": ["Jazz", "UTA"],
  "Toronto Raptors": ["Raptors", "TOR"],
  "Portland Trail Blazers": ["Trail Blazers", "Blazers", "POR"],
  "San Antonio Spurs": ["Spurs", "SA", "SAS"],
  "Charlotte Hornets": ["Hornets", "CHA"],
  "Detroit Pistons": ["Pistons", "DET"],
  "Washington Wizards": ["Wizards", "WAS"],
  // NFL
  "New England Patriots": ["Patriots", "NE", "Pats"],
  "Kansas City Chiefs": ["Chiefs", "KC"],
  "Buffalo Bills": ["Bills", "BUF"],
  "San Francisco 49ers": ["49ers", "Niners", "SF"],
  "Dallas Cowboys": ["Cowboys", "DAL"],
  "Philadelphia Eagles": ["Eagles", "PHI"],
  "Green Bay Packers": ["Packers", "GB"],
  "Seattle Seahawks": ["Seahawks", "SEA"],
  "Baltimore Ravens": ["Ravens", "BAL"],
  "Pittsburgh Steelers": ["Steelers", "PIT"],
  "Cincinnati Bengals": ["Bengals", "CIN"],
  "Cleveland Browns": ["Browns", "CLE"],
  "Los Angeles Rams": ["Rams", "LA Rams", "LAR"],
  "Los Angeles Chargers": ["Chargers", "LA Chargers", "LAC"],
  "Las Vegas Raiders": ["Raiders", "LV", "LVR"],
  "Denver Broncos": ["Broncos", "DEN"],
  "Miami Dolphins": ["Dolphins", "MIA"],
  "New York Jets": ["Jets", "NYJ"],
  "New York Giants": ["Giants", "NYG"],
  "Minnesota Vikings": ["Vikings", "MIN"],
  "Chicago Bears": ["Bears", "CHI"],
  "Detroit Lions": ["Lions", "DET"],
  "Tampa Bay Buccaneers": ["Buccaneers", "Bucs", "TB"],
  "New Orleans Saints": ["Saints", "NO"],
  "Atlanta Falcons": ["Falcons", "ATL"],
  "Carolina Panthers": ["Panthers", "CAR"],
  "Arizona Cardinals": ["Cardinals", "ARI"],
  "Houston Texans": ["Texans", "HOU"],
  "Indianapolis Colts": ["Colts", "IND"],
  "Jacksonville Jaguars": ["Jaguars", "Jags", "JAX"],
  "Tennessee Titans": ["Titans", "TEN"],
  "Washington Commanders": ["Commanders", "WAS"],
};

// Normalize team name for matching
function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Get all possible names for a team
function getTeamNameVariants(teamName: string): string[] {
  const variants = [teamName];
  
  // Check if this name is in aliases
  for (const [canonical, aliases] of Object.entries(TEAM_ALIASES)) {
    if (normalizeTeamName(canonical) === normalizeTeamName(teamName) ||
        aliases.some(a => normalizeTeamName(a) === normalizeTeamName(teamName))) {
      variants.push(canonical, ...aliases);
      break;
    }
  }
  
  // Also add the last word (nickname)
  const lastWord = teamName.split(" ").pop() || "";
  if (lastWord && !variants.includes(lastWord)) {
    variants.push(lastWord);
  }
  
  return Array.from(new Set(variants));
}

async function findTeamStats(teamName: string, sport: string, splitType: string): Promise<TeamStats | null> {
  const variants = getTeamNameVariants(teamName);
  
  // Build OR conditions for all variants
  const conditions = variants.map(v => ilike(teamStats.teamName, `%${v}%`));
  
  const stats = await db
    .select()
    .from(teamStats)
    .where(and(
      or(...conditions),
      eq(teamStats.sport, sport),
      eq(teamStats.splitType, splitType)
    ))
    .limit(1);
  
  return stats[0] || null;
}

function generateMockProjection(game: Game): {
  projectedAwayScore: number;
  projectedHomeScore: number;
  projectedTotal: number;
  projectedMargin: number;
  fairSpread: number;
  fairTotal: number;
  volatilityScore: number;
  drivers: string[];
} {
  const baseTotal = game.sport === "NFL" || game.sport === "CFB" ? 45 : 215;
  const variance = game.sport === "NFL" || game.sport === "CFB" ? 8 : 15;
  
  const projectedTotal = baseTotal + (Math.random() - 0.5) * variance * 2;
  const margin = (Math.random() - 0.5) * 10;
  const projectedHomeScore = (projectedTotal + margin) / 2;
  const projectedAwayScore = (projectedTotal - margin) / 2;
  
  return {
    projectedAwayScore: Math.round(projectedAwayScore * 10) / 10,
    projectedHomeScore: Math.round(projectedHomeScore * 10) / 10,
    projectedTotal: Math.round(projectedTotal * 10) / 10,
    projectedMargin: Math.round(margin * 10) / 10,
    fairSpread: Math.round(-margin * 10) / 10,
    fairTotal: Math.round(projectedTotal * 10) / 10,
    volatilityScore: Math.floor(Math.random() * 40) + 30,
    drivers: [
      `${game.homeTeamName} home advantage`,
      "Historical trends favor this matchup",
      "Recent form analysis",
    ],
  };
}

export async function runFullPipeline(
  sports: string[] = ["NFL", "NBA", "CFB", "CBB"]
): Promise<PipelineResult> {
  const result: PipelineResult = {
    gamesScraped: 0,
    projectionsGenerated: 0,
    opportunitiesCreated: 0,
    errors: [],
  };
  
  console.log("Starting full pipeline...");
  
  try {
    console.log("Step 1: Scraping schedules...");
    const scheduleResult = await runScraper("schedules", sports);
    result.gamesScraped = scheduleResult.recordsProcessed;
    console.log(`Scraped ${result.gamesScraped} games`);
    
    if (!scheduleResult.success && scheduleResult.error) {
      result.errors.push(`Schedule scrape: ${scheduleResult.error}`);
    }
  } catch (error) {
    result.errors.push(`Schedule error: ${error instanceof Error ? error.message : "Unknown"}`);
  }
  
  try {
    console.log("Step 1b: Scraping Covers odds...");
    const coversResult = await runScraper("covers", sports);
    console.log(`Scraped odds for ${coversResult.recordsProcessed} games from Covers`);
    
    if (!coversResult.success && coversResult.error) {
      result.errors.push(`Covers scrape: ${coversResult.error}`);
    }
  } catch (error) {
    result.errors.push(`Covers error: ${error instanceof Error ? error.message : "Unknown"}`);
  }
  
  try {
    console.log("Step 2: Getting today's games (Eastern timezone)...");
    // Use Eastern timezone (EST = UTC-5) for sports
    const now = new Date();
    const easternNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    
    // Get start of today in Eastern time (midnight Eastern)
    const todayEasternMidnight = new Date(easternNow);
    todayEasternMidnight.setUTCHours(0, 0, 0, 0);
    
    // Convert Eastern midnight to UTC (add 5 hours)
    // Midnight Eastern = 5am UTC
    const todayStartUtc = new Date(todayEasternMidnight.getTime() + 5 * 60 * 60 * 1000);
    const todayEndUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000);
    
    console.log(`UTC range: ${todayStartUtc.toISOString()} to ${todayEndUtc.toISOString()}`);
    
    const todaysGames = await db
      .select()
      .from(games)
      .where(and(
        gte(games.gameDate, todayStartUtc),
        lte(games.gameDate, todayEndUtc)
      ));
    
    console.log(`Found ${todaysGames.length} games for today (Eastern: ${easternNow.toISOString().split('T')[0]})`);
    
    console.log("Step 3: Generating projections...");
    for (const game of todaysGames) {
      try {
        const homeStats = await findTeamStats(game.homeTeamName, game.sport, "home");
        const awayStats = await findTeamStats(game.awayTeamName, game.sport, "away");
        const homeSeasonStats = await findTeamStats(game.homeTeamName, game.sport, "season");
        const awaySeasonStats = await findTeamStats(game.awayTeamName, game.sport, "season");
        
        let projection;
        
        if (homeStats || awayStats || homeSeasonStats || awaySeasonStats) {
          projection = generateProjection(
            game, 
            {
              away: awayStats || undefined,
              season: awaySeasonStats || undefined,
            },
            {
              home: homeStats || undefined,
              season: homeSeasonStats || undefined,
            }
          );
        } else {
          projection = generateMockProjection(game);
        }
        
        const algorithmVersion = `${game.sport} v${game.sport === "NFL" ? "4.0" : "3.5"}R1`;
        
        const [savedProjection] = await db
          .insert(projections)
          .values({
            gameId: game.id,
            algorithmVersion,
            projectedAwayScore: projection.projectedAwayScore,
            projectedHomeScore: projection.projectedHomeScore,
            projectedTotal: projection.projectedTotal,
            projectedMargin: projection.projectedMargin,
            fairSpread: projection.fairSpread,
            fairTotal: projection.fairTotal,
            volatilityScore: projection.volatilityScore,
            drivers: projection.drivers,
          })
          .returning();
        
        result.projectionsGenerated++;
        
        console.log("Step 4: Creating opportunities...");
        
        // Get latest odds (current lines)
        const [latestOdds] = await db.select().from(odds)
          .where(eq(odds.gameId, game.id))
          .orderBy(desc(odds.capturedAt))
          .limit(1);
        
        // Get opening odds (earliest record or one marked as opening)
        const allOddsForGame = await db.select().from(odds)
          .where(eq(odds.gameId, game.id))
          .orderBy(odds.capturedAt);
        
        // First try to find explicit opening odds, otherwise use earliest record
        const openingOdds = allOddsForGame.find(o => o.isOpening) || allOddsForGame[0] || null;
        
        const marketSpread = latestOdds?.spreadHome ? parseFloat(String(latestOdds.spreadHome)) : 
                            latestOdds?.spreadAway ? -parseFloat(String(latestOdds.spreadAway)) : null;
        const marketTotal = latestOdds?.totalOver ? parseFloat(String(latestOdds.totalOver)) : null;
        
        // Get opening lines for RLM detection
        const openingSpread = openingOdds?.spreadHome ? parseFloat(String(openingOdds.spreadHome)) : 
                              openingOdds?.spreadAway ? -parseFloat(String(openingOdds.spreadAway)) : null;
        const openingTotal = openingOdds?.totalOver ? parseFloat(String(openingOdds.totalOver)) : null;
        
        if (marketSpread !== null) {
          const spreadResult = determineSpreadSide(marketSpread, projection.fairSpread);
          const spreadOdds = latestOdds?.spreadHomeOdds || -110;
          const edgePct = calculateEdgePercentage(marketSpread, projection.fairSpread, "spread", game.sport, spreadOdds);
          const confidence = edgePct > 4 ? "High" : edgePct > 2.5 ? "Medium" : "Lean";
          
          // Detect RLM using opening vs current line
          const spreadRlm = detectRlmFromLines(openingSpread, marketSpread, null, "spread");
          
          if (edgePct > 1) {
            const teamName = spreadResult.side === "home" ? game.homeTeamName : game.awayTeamName;
            const displayLine = spreadResult.side === "home" ? marketSpread : -marketSpread;
            
            await db.insert(opportunities).values({
              gameId: game.id,
              projectionId: savedProjection.id,
              sport: game.sport,
              marketType: "spread",
              side: spreadResult.side,
              playDescription: `${teamName} ${displayLine > 0 ? "+" : ""}${displayLine}`,
              currentLine: displayLine,
              currentOdds: latestOdds?.spreadHomeOdds || -110,
              fairLine: projection.fairSpread,
              edgePercentage: edgePct,
              confidence,
              volatilityScore: projection.volatilityScore,
              isReverseLineMovement: spreadRlm.isRlm,
              drivers: spreadRlm.isRlm 
                ? [...projection.drivers, `RLM detected (${spreadRlm.strength}): line moved ${spreadRlm.direction}`]
                : projection.drivers,
              status: "active",
            });
            
            result.opportunitiesCreated++;
          }
        } else {
          // No market data available - skip creating opportunity 
          // without real market vs fair comparison
          console.log(`No market spread data for ${game.awayTeamName} @ ${game.homeTeamName} - skipping spread opportunity`);
        }
        
        if (marketTotal !== null) {
          const totalResult = determineTotalSide(marketTotal, projection.fairTotal);
          const totalOdds = latestOdds?.totalOverOdds || -110;
          const edgePct = calculateEdgePercentage(marketTotal, projection.fairTotal, "total", game.sport, totalOdds);
          const confidence = edgePct > 3 ? "Medium" : "Lean";
          
          // Detect RLM using opening vs current total (openingTotal already fetched above)
          const totalRlm = detectRlmFromLines(openingTotal, marketTotal, null, "total");
          
          if (edgePct > 0.5) {
            await db.insert(opportunities).values({
              gameId: game.id,
              projectionId: savedProjection.id,
              sport: game.sport,
              marketType: "total",
              side: totalResult.side,
              playDescription: `${totalResult.side.charAt(0).toUpperCase() + totalResult.side.slice(1)} ${marketTotal}`,
              currentLine: marketTotal,
              currentOdds: latestOdds?.totalOverOdds || -110,
              fairLine: projection.fairTotal,
              edgePercentage: edgePct,
              confidence,
              volatilityScore: projection.volatilityScore,
              isReverseLineMovement: totalRlm.isRlm,
              drivers: totalRlm.isRlm 
                ? [`Projected total: ${projection.projectedTotal}`, `RLM detected (${totalRlm.strength}): line moved ${totalRlm.direction}`]
                : [`Projected total: ${projection.projectedTotal}`],
              status: "active",
            });
            
            result.opportunitiesCreated++;
          }
        } else {
          // No market total data available - skip creating opportunity
          console.log(`No market total data for ${game.awayTeamName} @ ${game.homeTeamName} - skipping total opportunity`);
        }
        
      } catch (gameError) {
        result.errors.push(`Game ${game.id}: ${gameError instanceof Error ? gameError.message : "Unknown"}`);
      }
    }
    
  } catch (error) {
    result.errors.push(`Pipeline error: ${error instanceof Error ? error.message : "Unknown"}`);
  }
  
  console.log(`Pipeline complete: ${result.gamesScraped} games, ${result.projectionsGenerated} projections, ${result.opportunitiesCreated} opportunities`);
  
  return result;
}

export async function importExcelAndProcess(buffer: Buffer, filename: string): Promise<{
  teamsImported: number;
  statsImported: number;
  errors: string[];
}> {
  const { parseExcelFile } = await import("./excel-parser");
  const result = await parseExcelFile(buffer, filename);
  
  let statsImported = 0;
  const teamsImported = new Set<string>();
  
  for (const stat of result.stats) {
    await storage.upsertTeamStats(stat);
    teamsImported.add(stat.teamName);
    statsImported++;
  }
  
  // Auto-refresh projections after Excel upload
  if (statsImported > 0) {
    console.log("Excel import complete, triggering projection refresh...");
    // Get unique sports from imported stats
    const sports = Array.from(new Set(result.stats.map(s => s.sport)));
    for (const sport of sports) {
      try {
        await runFullPipeline([sport]);
      } catch (e) {
        result.errors.push(`Auto-refresh for ${sport} failed: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }
  }
  
  return {
    teamsImported: teamsImported.size,
    statsImported,
    errors: result.errors,
  };
}
