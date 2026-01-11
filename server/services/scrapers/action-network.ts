import { getBrowser, createPage, waitAndClick, waitAndType, delay } from "./browser-utils";
import type { Page } from "puppeteer";
import type { InsertGame, InsertOdds, InsertBettingPercentage, InsertLineMovement } from "@shared/schema";

interface ActionNetworkCredentials {
  email: string;
  password: string;
}

interface ScrapedGameData {
  game: Partial<InsertGame>;
  odds: Partial<InsertOdds>;
  bettingPercentages: Partial<InsertBettingPercentage>[];
  lineMovements: Partial<InsertLineMovement>[];
}

const SPORT_URLS: Record<string, string> = {
  NFL: "https://www.actionnetwork.com/nfl/odds",
  NBA: "https://www.actionnetwork.com/nba/odds",
  CFB: "https://www.actionnetwork.com/ncaaf/odds",
  CBB: "https://www.actionnetwork.com/ncaab/odds",
};

export async function loginToActionNetwork(
  page: Page,
  credentials: ActionNetworkCredentials
): Promise<boolean> {
  try {
    console.log("Navigating to Action Network login...");
    await page.goto("https://www.actionnetwork.com/login", { waitUntil: "networkidle2" });
    
    await delay(2000);
    
    // Look for email input
    const emailSelector = 'input[type="email"], input[name="email"], #email';
    const passwordSelector = 'input[type="password"], input[name="password"], #password';
    
    await waitAndType(page, emailSelector, credentials.email);
    await waitAndType(page, passwordSelector, credentials.password);
    
    // Click login button - use XPath for text matching since Puppeteer doesn't support :contains()
    const loginClicked = await page.evaluate(() => {
      // Try standard selectors first
      const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        (submitBtn as HTMLElement).click();
        return true;
      }
      // Fall back to finding button by text
      const buttons = Array.from(document.querySelectorAll('button'));
      const loginBtn = buttons.find(btn => 
        btn.textContent?.toLowerCase().includes('log in') || 
        btn.textContent?.toLowerCase().includes('login') ||
        btn.textContent?.toLowerCase().includes('sign in')
      );
      if (loginBtn) {
        loginBtn.click();
        return true;
      }
      return false;
    });
    
    if (!loginClicked) {
      console.error("Could not find login button");
      return false;
    }
    
    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });
    
    // Check if logged in by looking for user menu or profile element
    const isLoggedIn = await page.evaluate(() => {
      return document.body.innerText.includes("Account") || 
             document.querySelector('[data-testid="user-menu"]') !== null;
    });
    
    console.log("Action Network login:", isLoggedIn ? "Success" : "Failed");
    return isLoggedIn;
  } catch (error) {
    console.error("Action Network login error:", error);
    return false;
  }
}

export async function scrapeOddsPage(page: Page, sport: string): Promise<ScrapedGameData[]> {
  const games: ScrapedGameData[] = [];
  
  try {
    const url = SPORT_URLS[sport];
    if (!url) {
      console.error(`Unknown sport: ${sport}`);
      return games;
    }
    
    console.log(`Scraping ${sport} odds from: ${url}`);
    await page.goto(url, { waitUntil: "networkidle2" });
    await delay(3000);
    
    // Extract game data from the odds table
    const gameRows = await page.$$eval('[data-testid="game-row"], .game-row, .odds-row, tr[data-game-id]', rows => {
      return rows.map(row => {
        const getText = (selector: string) => {
          const el = row.querySelector(selector);
          return el?.textContent?.trim() || null;
        };
        
        const getNumber = (selector: string) => {
          const text = getText(selector);
          if (!text) return null;
          const num = parseFloat(text.replace(/[^0-9.-]/g, ""));
          return isNaN(num) ? null : num;
        };
        
        return {
          awayTeam: getText('.away-team, [data-testid="away-team"]') || getText('td:nth-child(1)'),
          homeTeam: getText('.home-team, [data-testid="home-team"]') || getText('td:nth-child(2)'),
          gameTime: getText('.game-time, [data-testid="game-time"]'),
          spread: getNumber('.spread, [data-testid="spread"]'),
          total: getNumber('.total, [data-testid="total"]'),
          awayML: getNumber('.away-moneyline, [data-testid="away-ml"]'),
          homeML: getNumber('.home-moneyline, [data-testid="home-ml"]'),
          spreadTicketPct: getNumber('[data-testid="spread-ticket-pct"]'),
          spreadMoneyPct: getNumber('[data-testid="spread-money-pct"]'),
          totalOverTicketPct: getNumber('[data-testid="over-ticket-pct"]'),
          totalOverMoneyPct: getNumber('[data-testid="over-money-pct"]'),
        };
      });
    });
    
    for (const row of gameRows) {
      if (!row.awayTeam || !row.homeTeam) continue;
      
      const gameData: ScrapedGameData = {
        game: {
          awayTeamName: row.awayTeam,
          homeTeamName: row.homeTeam,
          sport,
          status: "scheduled",
        },
        odds: {
          sportsbook: "consensus",
          spreadHome: row.spread ? -row.spread : undefined,
          spreadAway: row.spread ?? undefined,
          totalOver: row.total ?? undefined,
          moneylineHome: row.homeML ?? undefined,
          moneylineAway: row.awayML ?? undefined,
        },
        bettingPercentages: [],
        lineMovements: [],
      };
      
      // Add spread betting percentages if available
      if (row.spreadTicketPct || row.spreadMoneyPct) {
        gameData.bettingPercentages.push({
          marketType: "spread",
          side: "away",
          ticketPercentage: row.spreadTicketPct ?? undefined,
          moneyPercentage: row.spreadMoneyPct ?? undefined,
        });
      }
      
      // Add total betting percentages if available
      if (row.totalOverTicketPct || row.totalOverMoneyPct) {
        gameData.bettingPercentages.push({
          marketType: "total",
          side: "over",
          ticketPercentage: row.totalOverTicketPct ?? undefined,
          moneyPercentage: row.totalOverMoneyPct ?? undefined,
        });
      }
      
      games.push(gameData);
    }
    
    console.log(`Scraped ${games.length} games from ${sport}`);
  } catch (error) {
    console.error(`Error scraping ${sport} odds:`, error);
  }
  
  return games;
}

export async function scrapeActionNetwork(
  sports: string[] = ["NFL", "NBA", "CFB", "CBB"]
): Promise<{ success: boolean; games: ScrapedGameData[]; error?: string }> {
  const email = process.env.ACTION_NETWORK_EMAIL;
  const password = process.env.ACTION_NETWORK_PASSWORD;
  
  if (!email || !password) {
    return {
      success: false,
      games: [],
      error: "Action Network credentials not configured. Please add ACTION_NETWORK_EMAIL and ACTION_NETWORK_PASSWORD secrets.",
    };
  }
  
  const allGames: ScrapedGameData[] = [];
  
  try {
    const browser = await getBrowser();
    const page = await createPage(browser);
    
    // Login first
    const loggedIn = await loginToActionNetwork(page, { email, password });
    if (!loggedIn) {
      await page.close();
      return {
        success: false,
        games: [],
        error: "Failed to login to Action Network. Please check your credentials.",
      };
    }
    
    // Scrape each sport
    for (const sport of sports) {
      const games = await scrapeOddsPage(page, sport);
      allGames.push(...games);
      await delay(2000); // Be respectful to the server
    }
    
    await page.close();
    
    return {
      success: true,
      games: allGames,
    };
  } catch (error) {
    console.error("Action Network scraper error:", error);
    return {
      success: false,
      games: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
