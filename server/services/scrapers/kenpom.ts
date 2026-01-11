import { getBrowser, createPage, waitAndType, delay } from "./browser-utils";
import type { Page } from "puppeteer";
import type { InsertTeamStats } from "@shared/schema";

interface KenPomCredentials {
  email: string;
  password: string;
}

interface KenPomTeamData {
  teamName: string;
  rank: number;
  conference: string;
  record: string;
  adjustedEfficiencyMargin: number;
  offensiveRating: number;
  offensiveRank: number;
  defensiveRating: number;
  defensiveRank: number;
  tempo: number;
  tempoRank: number;
  luck: number;
  strengthOfSchedule: number;
}

interface FanMatchGame {
  awayTeam: string;
  homeTeam: string;
  projectedScore: string;
  winProbability: number;
  spread: number;
  total: number;
}

export async function loginToKenPom(
  page: Page,
  credentials: KenPomCredentials
): Promise<boolean> {
  try {
    console.log("Navigating to KenPom login...");
    await page.goto("https://kenpom.com/", { waitUntil: "networkidle2" });
    
    await delay(2000);
    
    // Look for login form
    const emailInput = await page.$('input[name="email"], input[type="email"], #email');
    const passwordInput = await page.$('input[name="password"], input[type="password"], #password');
    
    if (!emailInput || !passwordInput) {
      // Try to find and click login link first
      const loginLink = await page.$('a[href*="login"], a:contains("Login"), .login-link');
      if (loginLink) {
        await loginLink.click();
        await page.waitForNavigation({ waitUntil: "networkidle2" });
        await delay(1000);
      }
    }
    
    await waitAndType(page, 'input[name="email"], input[type="email"]', credentials.email);
    await waitAndType(page, 'input[name="password"], input[type="password"]', credentials.password);
    
    // Submit the form
    await page.keyboard.press("Enter");
    
    await delay(3000);
    
    // Check if logged in - KenPom shows subscriber content when logged in
    const isLoggedIn = await page.evaluate(() => {
      return document.body.innerText.includes("Log out") || 
             document.body.innerText.includes("Logout") ||
             document.querySelector('.logout') !== null;
    });
    
    console.log("KenPom login:", isLoggedIn ? "Success" : "Failed");
    return isLoggedIn;
  } catch (error) {
    console.error("KenPom login error:", error);
    return false;
  }
}

export async function scrapeTeamRatings(page: Page): Promise<KenPomTeamData[]> {
  const teams: KenPomTeamData[] = [];
  
  try {
    console.log("Scraping KenPom team ratings...");
    await page.goto("https://kenpom.com/", { waitUntil: "networkidle2" });
    await delay(2000);
    
    // Extract data from the main ratings table
    const tableData = await page.$$eval('#ratings-table tbody tr, table tbody tr', rows => {
      return rows.map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 10) return null;
        
        const getText = (idx: number) => cells[idx]?.textContent?.trim() || "";
        const getNumber = (idx: number) => {
          const text = getText(idx);
          const num = parseFloat(text.replace(/[^0-9.-]/g, ""));
          return isNaN(num) ? 0 : num;
        };
        
        return {
          rank: getNumber(0),
          teamName: getText(1).replace(/[0-9]+$/, "").trim(),
          conference: getText(2),
          record: getText(3),
          adjustedEfficiencyMargin: getNumber(4),
          offensiveRating: getNumber(5),
          offensiveRank: getNumber(6),
          defensiveRating: getNumber(7),
          defensiveRank: getNumber(8),
          tempo: getNumber(9),
          tempoRank: getNumber(10),
          luck: getNumber(11),
          strengthOfSchedule: getNumber(12),
        };
      }).filter(t => t !== null && t.teamName);
    });
    
    teams.push(...(tableData as KenPomTeamData[]));
    console.log(`Scraped ${teams.length} teams from KenPom`);
  } catch (error) {
    console.error("Error scraping KenPom ratings:", error);
  }
  
  return teams;
}

export async function scrapeFanMatch(page: Page): Promise<FanMatchGame[]> {
  const games: FanMatchGame[] = [];
  
  try {
    console.log("Scraping KenPom FanMatch...");
    await page.goto("https://kenpom.com/fanmatch.php", { waitUntil: "networkidle2" });
    await delay(2000);
    
    // Extract FanMatch game data
    const gameData = await page.$$eval('table tbody tr', rows => {
      return rows.map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 6) return null;
        
        const getText = (idx: number) => cells[idx]?.textContent?.trim() || "";
        const getNumber = (idx: number) => {
          const text = getText(idx);
          const num = parseFloat(text.replace(/[^0-9.-]/g, ""));
          return isNaN(num) ? 0 : num;
        };
        
        // Parse matchup - usually "Team A at Team B" or "Team A vs Team B"
        const matchupText = getText(0);
        const matchupMatch = matchupText.match(/(.+?)\s+(?:at|vs\.?|@)\s+(.+)/i);
        
        if (!matchupMatch) return null;
        
        return {
          awayTeam: matchupMatch[1].trim(),
          homeTeam: matchupMatch[2].trim(),
          projectedScore: getText(1),
          winProbability: getNumber(2),
          spread: getNumber(3),
          total: getNumber(4),
        };
      }).filter(g => g !== null);
    });
    
    games.push(...(gameData as FanMatchGame[]));
    console.log(`Scraped ${games.length} games from FanMatch`);
  } catch (error) {
    console.error("Error scraping FanMatch:", error);
  }
  
  return games;
}

export function convertToTeamStats(kenPomData: KenPomTeamData[]): InsertTeamStats[] {
  return kenPomData.map(team => ({
    teamName: team.teamName,
    sport: "CBB" as const,
    splitType: "season",
    source: "kenpom",
    offensiveRating: team.offensiveRating,
    defensiveRating: team.defensiveRating,
    pace: team.tempo,
    kenpomRank: team.rank,
    kenpomAdjustedEfficiency: team.adjustedEfficiencyMargin,
    kenpomTempo: team.tempo,
    kenpomLuck: team.luck,
    strengthOfSchedule: team.strengthOfSchedule,
    offensivePPP: null,
    defensivePPP: null,
    possessionsPerGame: null,
    opponentPossessionsPerGame: null,
    playsPerGame: null,
    effectiveFieldGoalPct: null,
    turnoverPct: null,
    offensiveReboundPct: null,
    freeThrowRate: null,
    threePointPct: null,
    threePointRate: null,
    freeThrowPct: null,
    rimFinishingPct: null,
    yardsPerPlay: null,
    opponentYardsPerPlay: null,
    redZoneScoringPct: null,
    thirdDownConversionPct: null,
    penaltiesPerGame: null,
    rawData: team,
  }));
}

export async function scrapeKenPom(): Promise<{ 
  success: boolean; 
  teams: InsertTeamStats[]; 
  fanMatchGames: FanMatchGame[];
  error?: string 
}> {
  const email = process.env.KENPOM_EMAIL;
  const password = process.env.KENPOM_PASSWORD;
  
  if (!email || !password) {
    return {
      success: false,
      teams: [],
      fanMatchGames: [],
      error: "KenPom credentials not configured. Please add KENPOM_EMAIL and KENPOM_PASSWORD secrets.",
    };
  }
  
  try {
    const browser = await getBrowser();
    const page = await createPage(browser);
    
    // Login first
    const loggedIn = await loginToKenPom(page, { email, password });
    if (!loggedIn) {
      await page.close();
      return {
        success: false,
        teams: [],
        fanMatchGames: [],
        error: "Failed to login to KenPom. Please check your credentials.",
      };
    }
    
    // Scrape team ratings
    const kenPomTeams = await scrapeTeamRatings(page);
    const teams = convertToTeamStats(kenPomTeams);
    
    // Scrape FanMatch games
    const fanMatchGames = await scrapeFanMatch(page);
    
    await page.close();
    
    return {
      success: true,
      teams,
      fanMatchGames,
    };
  } catch (error) {
    console.error("KenPom scraper error:", error);
    return {
      success: false,
      teams: [],
      fanMatchGames: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
