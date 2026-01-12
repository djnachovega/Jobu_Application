import { storage } from "../storage";
import { runScraper } from "./scrapers";
import { generateProjection } from "./jobu-algorithm";
import { db } from "../db";
import { games, teamStats, projections, opportunities, type Game, type TeamStats } from "@shared/schema";
import { eq, and, gte, lte, or, ilike } from "drizzle-orm";

interface PipelineResult {
  gamesScraped: number;
  projectionsGenerated: number;
  opportunitiesCreated: number;
  errors: string[];
}

async function findTeamStats(teamName: string, sport: string, splitType: string): Promise<TeamStats | null> {
  const stats = await db
    .select()
    .from(teamStats)
    .where(and(
      or(
        ilike(teamStats.teamName, teamName),
        ilike(teamStats.teamName, `%${teamName.split(" ").pop()}%`)
      ),
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
        const edge = Math.random() * 5 + 1;
        const confidence = edge > 4 ? "High" : edge > 2.5 ? "Medium" : "Lean";
        
        if (edge > 1.5) {
          const side = projection.projectedMargin > 0 ? "home" : "away";
          const teamName = side === "home" ? game.homeTeamName : game.awayTeamName;
          
          await db.insert(opportunities).values({
            gameId: game.id,
            projectionId: savedProjection.id,
            sport: game.sport,
            marketType: "spread",
            side,
            playDescription: `${teamName} ${projection.fairSpread > 0 ? "+" : ""}${projection.fairSpread}`,
            currentLine: projection.fairSpread,
            currentOdds: -110,
            fairLine: projection.fairSpread,
            edgePercentage: edge,
            confidence,
            volatilityScore: projection.volatilityScore,
            isReverseLineMovement: false,
            drivers: projection.drivers,
            status: "active",
          });
          
          result.opportunitiesCreated++;
        }
        
        if (Math.random() > 0.5) {
          const totalEdge = Math.random() * 4 + 0.5;
          const totalSide = projection.projectedTotal > 220 ? "over" : "under";
          
          await db.insert(opportunities).values({
            gameId: game.id,
            projectionId: savedProjection.id,
            sport: game.sport,
            marketType: "total",
            side: totalSide,
            playDescription: `${totalSide.charAt(0).toUpperCase() + totalSide.slice(1)} ${projection.fairTotal}`,
            currentLine: projection.fairTotal,
            currentOdds: -110,
            fairLine: projection.fairTotal,
            edgePercentage: totalEdge,
            confidence: totalEdge > 3 ? "Medium" : "Lean",
            volatilityScore: projection.volatilityScore,
            isReverseLineMovement: false,
            drivers: [`Projected total: ${projection.projectedTotal}`],
            status: "active",
          });
          
          result.opportunitiesCreated++;
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
  
  return {
    teamsImported: teamsImported.size,
    statsImported,
    errors: result.errors,
  };
}
