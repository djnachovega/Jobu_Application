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
          // Create or find game (deduplication)
          if (gameData.game.awayTeamName && gameData.game.homeTeamName) {
            const game = await storage.findOrCreateGame({
              awayTeamName: gameData.game.awayTeamName,
              homeTeamName: gameData.game.homeTeamName,
              sport: gameData.game.sport || "NFL",
              gameDate: new Date(),
              status: "scheduled",
            });
            
            // Store odds if any data exists (spread, total, or moneyline)
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
            
            // Store line movements if available
            for (const movement of gameData.lineMovements) {
              if (movement.previousLine !== undefined && movement.newLine !== undefined) {
                await storage.createLineMovement({
                  gameId: game.id,
                  sportsbook: movement.sportsbook || "consensus",
                  marketType: movement.marketType || "spread",
                  previousLine: movement.previousLine,
                  newLine: movement.newLine,
                  previousOdds: movement.previousOdds,
                  newOdds: movement.newOdds,
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
