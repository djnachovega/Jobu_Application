import { storage } from "../../storage";
import { scrapeActionNetworkHttp } from "./actionnetwork-http";
import { scrapeKenPomHttp } from "./kenpom-http";
import { scrapeTeamRankingsHttp } from "./teamrankings-http";

export type ScraperName = "actionnetwork" | "teamrankings" | "kenpom";

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
      case "actionnetwork": {
        const result = await scrapeActionNetworkHttp(sports);
        
        if (!result.success) {
          return {
            success: false,
            message: "Action Network scrape failed",
            recordsProcessed: 0,
            error: result.error,
          };
        }
        
        let processed = 0;
        for (const gameData of result.games) {
          if (gameData.game.awayTeamName && gameData.game.homeTeamName) {
            const game = await storage.findOrCreateGame({
              awayTeamName: gameData.game.awayTeamName,
              homeTeamName: gameData.game.homeTeamName,
              sport: gameData.game.sport || "NFL",
              gameDate: new Date(),
              status: "scheduled",
            });
            
            const hasOdds = gameData.odds.spreadHome !== undefined || 
                           gameData.odds.spreadAway !== undefined ||
                           gameData.odds.totalOver !== undefined ||
                           gameData.odds.moneylineHome !== undefined ||
                           gameData.odds.moneylineAway !== undefined;
            
            if (hasOdds) {
              await storage.createOdds({
                gameId: game.id,
                sportsbook: gameData.odds.sportsbook || "consensus",
                spreadHome: gameData.odds.spreadHome,
                spreadAway: gameData.odds.spreadAway,
                spreadHomeOdds: gameData.odds.spreadHome !== undefined ? -110 : undefined,
                spreadAwayOdds: gameData.odds.spreadAway !== undefined ? -110 : undefined,
                totalOver: gameData.odds.totalOver,
                totalOverOdds: gameData.odds.totalOver !== undefined ? -110 : undefined,
                totalUnderOdds: gameData.odds.totalOver !== undefined ? -110 : undefined,
                moneylineHome: gameData.odds.moneylineHome,
                moneylineAway: gameData.odds.moneylineAway,
              });
            }
            
            for (const pct of gameData.bettingPercentages) {
              if (pct.ticketPercentage || pct.moneyPercentage) {
                await storage.createBettingPercentage({
                  gameId: game.id,
                  marketType: pct.marketType || "spread",
                  side: pct.side || "home",
                  ticketPercentage: pct.ticketPercentage || 50,
                  moneyPercentage: pct.moneyPercentage || 50,
                });
              }
            }
            
            processed++;
          }
        }
        
        return {
          success: true,
          message: `Scraped ${processed} games from Action Network`,
          recordsProcessed: processed,
        };
      }
      
      case "kenpom": {
        const result = await scrapeKenPomHttp();
        
        if (!result.success) {
          return {
            success: false,
            message: "KenPom scrape failed",
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
          message: `Scraped ${processed} teams from KenPom`,
          recordsProcessed: processed,
        };
      }
      
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
