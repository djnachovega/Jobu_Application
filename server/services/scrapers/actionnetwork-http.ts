import { createHttpClient, parseHtml, delay } from "./http-client";
import type { InsertGame, InsertOdds, InsertBettingPercentage, InsertLineMovement } from "@shared/schema";

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

async function loginToActionNetwork(
  client: ReturnType<typeof createHttpClient>["client"],
  email: string,
  password: string
): Promise<boolean> {
  try {
    console.log("Logging into Action Network...");
    
    const loginResponse = await client.post(
      "https://www.actionnetwork.com/api/web/auth/login",
      { email, password },
      {
        headers: {
          "Content-Type": "application/json",
          "Origin": "https://www.actionnetwork.com",
          "Referer": "https://www.actionnetwork.com/login",
        },
      }
    );
    
    const success = loginResponse.status === 200 && loginResponse.data?.user;
    console.log("Action Network login:", success ? "Success" : "Failed");
    return success;
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log("Action Network login: Invalid credentials");
      return false;
    }
    console.error("Action Network login error:", error.message);
    return false;
  }
}

async function scrapeOddsPage(
  client: ReturnType<typeof createHttpClient>["client"],
  sport: string
): Promise<ScrapedGameData[]> {
  const games: ScrapedGameData[] = [];
  
  try {
    const url = SPORT_URLS[sport];
    if (!url) {
      console.error(`Unknown sport: ${sport}`);
      return games;
    }
    
    console.log(`Fetching ${sport} odds from: ${url}`);
    const response = await client.get(url);
    const $ = parseHtml(response.data);
    
    $('[data-testid="game-row"], .game-row, .matchup-row, article[class*="game"]').each((_, element) => {
      const $el = $(element);
      
      const awayTeam = $el.find('[data-testid="away-team"], .away-team, .team-name:first').text().trim();
      const homeTeam = $el.find('[data-testid="home-team"], .home-team, .team-name:last').text().trim();
      
      if (!awayTeam || !homeTeam) return;
      
      const spreadText = $el.find('[data-testid="spread"], .spread').text().trim();
      const totalText = $el.find('[data-testid="total"], .total').text().trim();
      const awayMLText = $el.find('[data-testid="away-ml"], .away-moneyline').text().trim();
      const homeMLText = $el.find('[data-testid="home-ml"], .home-moneyline').text().trim();
      
      const parseNumber = (text: string) => {
        const num = parseFloat(text.replace(/[^0-9.-]/g, ""));
        return isNaN(num) ? undefined : num;
      };
      
      const gameData: ScrapedGameData = {
        game: {
          awayTeamName: awayTeam,
          homeTeamName: homeTeam,
          sport,
          status: "scheduled",
        },
        odds: {
          sportsbook: "consensus",
          spreadAway: parseNumber(spreadText),
          spreadHome: parseNumber(spreadText) ? -parseNumber(spreadText)! : undefined,
          totalOver: parseNumber(totalText),
          moneylineAway: parseNumber(awayMLText),
          moneylineHome: parseNumber(homeMLText),
        },
        bettingPercentages: [],
        lineMovements: [],
      };
      
      const spreadTicketPct = parseNumber($el.find('[data-testid="spread-ticket-pct"]').text());
      const spreadMoneyPct = parseNumber($el.find('[data-testid="spread-money-pct"]').text());
      
      if (spreadTicketPct || spreadMoneyPct) {
        gameData.bettingPercentages.push({
          marketType: "spread",
          side: "away",
          ticketPercentage: spreadTicketPct || 50,
          moneyPercentage: spreadMoneyPct || 50,
        });
      }
      
      games.push(gameData);
    });
    
    console.log(`Scraped ${games.length} games from ${sport}`);
  } catch (error) {
    console.error(`Error fetching ${sport} odds:`, error instanceof Error ? error.message : error);
  }
  
  return games;
}

export async function scrapeActionNetworkHttp(
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
    const { client } = createHttpClient();
    
    const loggedIn = await loginToActionNetwork(client, email, password);
    if (!loggedIn) {
      console.log("Proceeding without login - some data may be limited");
    }
    
    for (const sport of sports) {
      const games = await scrapeOddsPage(client, sport);
      allGames.push(...games);
      await delay(2000);
    }
    
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
