import { storage } from "../../storage";
import { scrapeTeamRankingsHttp } from "./teamrankings-http";
import { scrapeCoversOdds } from "./covers-http";
import { scrapeAllSchedules, scrapeNBASchedule, scrapeNFLSchedule, scrapeCFBSchedule, scrapeCBBSchedule } from "./league-schedules";
import { getOrCreateTeam } from "../team-resolver";

export type ScraperName = "teamrankings" | "covers" | "schedules" | "nba" | "nfl" | "cfb" | "cbb";

export interface ScraperResult {
  success: boolean;
  message: string;
  recordsProcessed: number;
  error?: string;
}

export async function runScraper(name: ScraperName, sports?: string[]): Promise<ScraperResult> {
  console.log(`Starting scraper: ${name}`);
  
  try {
    switch (name) {
      case "teamrankings": {
        const result = await scrapeTeamRankingsHttp(sports);
        
        if (!result.success) {
          return {
            success: false,
            message: "TeamRankings scrape failed",
            recordsProcessed: 0,
            error: result.error,
          };
        }
        
        let processed = 0;
        for (const team of result.teams) {
          await storage.upsertTeamStats(team);
          processed++;
        }
        
        return {
          success: true,
          message: `Scraped ${processed} teams from TeamRankings`,
          recordsProcessed: processed,
        };
      }

      case "covers": {
        const result = await scrapeCoversOdds(sports);
        
        if (!result.success) {
          return {
            success: false,
            message: "Covers.com scrape failed",
            recordsProcessed: 0,
            error: result.error,
          };
        }
        
        let processed = 0;
        for (const gameOdds of result.odds) {
          const awayTeam = await getOrCreateTeam(gameOdds.awayTeam, gameOdds.sport);
          const homeTeam = await getOrCreateTeam(gameOdds.homeTeam, gameOdds.sport);
          
          const game = await storage.findGameByTeams(
            gameOdds.awayTeam,
            gameOdds.homeTeam,
            gameOdds.sport
          );
          
          if (game) {
            await storage.createOdds({
              gameId: game.id,
              sportsbook: "covers_consensus",
              spreadHome: gameOdds.spreadHome !== null ? String(gameOdds.spreadHome) : undefined,
              spreadAway: gameOdds.spreadAway !== null ? String(gameOdds.spreadAway) : undefined,
              spreadHomeOdds: -110,
              spreadAwayOdds: -110,
              totalOver: gameOdds.totalOver !== null ? String(gameOdds.totalOver) : undefined,
              totalOverOdds: -110,
              totalUnderOdds: -110,
              moneylineHome: gameOdds.moneylineHome,
              moneylineAway: gameOdds.moneylineAway,
            });
            
            if (gameOdds.openSpreadHome !== null && gameOdds.spreadHome !== null) {
              const movement = gameOdds.spreadHome - gameOdds.openSpreadHome;
              if (Math.abs(movement) >= 0.5) {
                await storage.createLineMovement({
                  gameId: game.id,
                  marketType: "spread",
                  previousValue: gameOdds.openSpreadHome,
                  currentValue: gameOdds.spreadHome,
                  movementDirection: movement > 0 ? "up" : "down",
                  movementSize: Math.abs(movement),
                });
              }
            }
            
            processed++;
          }
        }
        
        return {
          success: true,
          message: `Scraped ${processed} games from Covers.com`,
          recordsProcessed: processed,
        };
      }
      
      case "schedules": {
        const result = await scrapeAllSchedules();
        
        let processed = 0;
        for (const sportData of result.games) {
          for (const game of sportData.data) {
            if (game.awayTeam && game.homeTeam) {
              const awayTeam = await getOrCreateTeam(game.awayTeam, sportData.sport);
              const homeTeam = await getOrCreateTeam(game.homeTeam, sportData.sport);
              
              await storage.findOrCreateGame({
                sport: sportData.sport,
                awayTeamName: game.awayTeam,
                homeTeamName: game.homeTeam,
                awayTeamId: awayTeam.id,
                homeTeamId: homeTeam.id,
                gameDate: game.gameDate,
                externalId: game.externalId,
                venue: game.venue,
                status: game.status || "scheduled",
              });
              processed++;
            }
          }
        }
        
        return {
          success: true,
          message: `Scraped ${processed} games from league schedules`,
          recordsProcessed: processed,
        };
      }
      
      case "nba": {
        const result = await scrapeNBASchedule();
        if (!result.success) {
          return { success: false, message: "NBA schedule scrape failed", recordsProcessed: 0, error: result.error };
        }
        
        let processed = 0;
        for (const game of result.games) {
          if (game.awayTeam && game.homeTeam) {
            const awayTeam = await getOrCreateTeam(game.awayTeam, "NBA");
            const homeTeam = await getOrCreateTeam(game.homeTeam, "NBA");
            
            await storage.findOrCreateGame({
              sport: "NBA",
              awayTeamName: game.awayTeam,
              homeTeamName: game.homeTeam,
              awayTeamId: awayTeam.id,
              homeTeamId: homeTeam.id,
              gameDate: game.gameDate,
              externalId: game.externalId,
              venue: game.venue,
              status: game.status || "scheduled",
            });
            processed++;
          }
        }
        
        return { success: true, message: `Scraped ${processed} NBA games`, recordsProcessed: processed };
      }
      
      case "nfl": {
        const result = await scrapeNFLSchedule();
        if (!result.success) {
          return { success: false, message: "NFL schedule scrape failed", recordsProcessed: 0, error: result.error };
        }
        
        let processed = 0;
        for (const game of result.games) {
          if (game.awayTeam && game.homeTeam) {
            const awayTeam = await getOrCreateTeam(game.awayTeam, "NFL");
            const homeTeam = await getOrCreateTeam(game.homeTeam, "NFL");
            
            await storage.findOrCreateGame({
              sport: "NFL",
              awayTeamName: game.awayTeam,
              homeTeamName: game.homeTeam,
              awayTeamId: awayTeam.id,
              homeTeamId: homeTeam.id,
              gameDate: game.gameDate,
              externalId: game.externalId,
              venue: game.venue,
              status: game.status || "scheduled",
            });
            processed++;
          }
        }
        
        return { success: true, message: `Scraped ${processed} NFL games`, recordsProcessed: processed };
      }
      
      case "cfb": {
        const result = await scrapeCFBSchedule();
        if (!result.success) {
          return { success: false, message: "CFB schedule scrape failed", recordsProcessed: 0, error: result.error };
        }
        
        let processed = 0;
        for (const game of result.games) {
          if (game.awayTeam && game.homeTeam) {
            const awayTeam = await getOrCreateTeam(game.awayTeam, "CFB");
            const homeTeam = await getOrCreateTeam(game.homeTeam, "CFB");
            
            await storage.findOrCreateGame({
              sport: "CFB",
              awayTeamName: game.awayTeam,
              homeTeamName: game.homeTeam,
              awayTeamId: awayTeam.id,
              homeTeamId: homeTeam.id,
              gameDate: game.gameDate,
              externalId: game.externalId,
              venue: game.venue,
              status: game.status || "scheduled",
            });
            processed++;
          }
        }
        
        return { success: true, message: `Scraped ${processed} CFB games`, recordsProcessed: processed };
      }
      
      case "cbb": {
        const result = await scrapeCBBSchedule();
        if (!result.success) {
          return { success: false, message: "CBB schedule scrape failed", recordsProcessed: 0, error: result.error };
        }
        
        let processed = 0;
        for (const game of result.games) {
          if (game.awayTeam && game.homeTeam) {
            const awayTeam = await getOrCreateTeam(game.awayTeam, "CBB");
            const homeTeam = await getOrCreateTeam(game.homeTeam, "CBB");
            
            await storage.findOrCreateGame({
              sport: "CBB",
              awayTeamName: game.awayTeam,
              homeTeamName: game.homeTeam,
              awayTeamId: awayTeam.id,
              homeTeamId: homeTeam.id,
              gameDate: game.gameDate,
              externalId: game.externalId,
              venue: game.venue,
              status: game.status || "scheduled",
            });
            processed++;
          }
        }
        
        return { success: true, message: `Scraped ${processed} CBB games`, recordsProcessed: processed };
      }
      
      default:
        return {
          success: false,
          message: `Unknown scraper: ${name}`,
          recordsProcessed: 0,
        };
    }
  } catch (error) {
    console.error(`Scraper error (${name}):`, error);
    return {
      success: false,
      message: `Scraper error: ${error instanceof Error ? error.message : "Unknown error"}`,
      recordsProcessed: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
