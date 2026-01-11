// Scraper exports
export { scrapeActionNetwork } from "./action-network";
export { scrapeKenPom } from "./kenpom";
export { scrapeTeamRankings, scrapeFromUrl } from "./teamrankings";
export { getBrowser, closeBrowser } from "./browser-utils";

import { storage } from "../../storage";
import { scrapeActionNetwork } from "./action-network";
import { scrapeKenPom } from "./kenpom";
import { scrapeTeamRankings } from "./teamrankings";

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
        const result = await scrapeActionNetwork(sports);
        
        if (!result.success) {
          return {
            success: false,
            message: "Action Network scrape failed",
            recordsProcessed: 0,
            error: result.error,
          };
        }
        
        // Store the scraped data
        let processed = 0;
        for (const gameData of result.games) {
          // Create or find game
          if (gameData.game.awayTeamName && gameData.game.homeTeamName) {
            const game = await storage.createGame({
              awayTeamName: gameData.game.awayTeamName,
              homeTeamName: gameData.game.homeTeamName,
              sport: gameData.game.sport || "NFL",
              gameDate: new Date(),
              status: "scheduled",
            });
            
            // Store odds
            if (gameData.odds.spreadHome !== undefined) {
              await storage.createOdds({
                gameId: game.id,
                sportsbook: gameData.odds.sportsbook || "consensus",
                spreadHome: gameData.odds.spreadHome,
                spreadAway: gameData.odds.spreadAway,
                spreadHomeOdds: -110,
                spreadAwayOdds: -110,
                totalOver: gameData.odds.totalOver,
                totalOverOdds: -110,
                totalUnderOdds: -110,
                moneylineHome: gameData.odds.moneylineHome,
                moneylineAway: gameData.odds.moneylineAway,
              });
            }
            
            // Store betting percentages
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
        const result = await scrapeKenPom();
        
        if (!result.success) {
          return {
            success: false,
            message: "KenPom scrape failed",
            recordsProcessed: 0,
            error: result.error,
          };
        }
        
        // Store team stats
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
        const result = await scrapeTeamRankings(sports);
        
        if (!result.success) {
          return {
            success: false,
            message: "TeamRankings scrape failed",
            recordsProcessed: 0,
            error: result.error,
          };
        }
        
        // Store team stats
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
