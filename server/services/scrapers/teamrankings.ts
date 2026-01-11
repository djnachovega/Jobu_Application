import { getBrowser, createPage, delay } from "./browser-utils";
import type { Page } from "puppeteer";
import type { InsertTeamStats } from "@shared/schema";

interface TeamRankingsData {
  teamName: string;
  value: number;
  rank: number;
}

const STAT_URLS: Record<string, Record<string, string>> = {
  NFL: {
    offensivePPP: "https://www.teamrankings.com/nfl/stat/points-per-play",
    defensivePPP: "https://www.teamrankings.com/nfl/stat/opponent-points-per-play",
    yardsPerPlay: "https://www.teamrankings.com/nfl/stat/yards-per-play",
    opponentYardsPerPlay: "https://www.teamrankings.com/nfl/stat/opponent-yards-per-play",
    redZoneScoringPct: "https://www.teamrankings.com/nfl/stat/red-zone-scoring-pct",
    thirdDownConversionPct: "https://www.teamrankings.com/nfl/stat/third-down-conversion-pct",
  },
  NBA: {
    offensiveRating: "https://www.teamrankings.com/nba/stat/offensive-efficiency",
    defensiveRating: "https://www.teamrankings.com/nba/stat/defensive-efficiency",
    pace: "https://www.teamrankings.com/nba/stat/possessions-per-game",
    effectiveFieldGoalPct: "https://www.teamrankings.com/nba/stat/effective-field-goal-pct",
    turnoverPct: "https://www.teamrankings.com/nba/stat/turnover-pct",
    offensiveReboundPct: "https://www.teamrankings.com/nba/stat/offensive-rebounding-pct",
    threePointPct: "https://www.teamrankings.com/nba/stat/three-point-pct",
  },
  CFB: {
    offensivePPP: "https://www.teamrankings.com/college-football/stat/points-per-play",
    defensivePPP: "https://www.teamrankings.com/college-football/stat/opponent-points-per-play",
    yardsPerPlay: "https://www.teamrankings.com/college-football/stat/yards-per-play",
    opponentYardsPerPlay: "https://www.teamrankings.com/college-football/stat/opponent-yards-per-play",
    redZoneScoringPct: "https://www.teamrankings.com/college-football/stat/red-zone-scoring-pct",
  },
  CBB: {
    offensiveRating: "https://www.teamrankings.com/ncaa-basketball/stat/offensive-efficiency",
    defensiveRating: "https://www.teamrankings.com/ncaa-basketball/stat/defensive-efficiency",
    pace: "https://www.teamrankings.com/ncaa-basketball/stat/possessions-per-game",
    effectiveFieldGoalPct: "https://www.teamrankings.com/ncaa-basketball/stat/effective-field-goal-pct",
    turnoverPct: "https://www.teamrankings.com/ncaa-basketball/stat/turnover-pct",
  },
};

export async function scrapeStatPage(page: Page, url: string): Promise<TeamRankingsData[]> {
  const data: TeamRankingsData[] = [];
  
  try {
    console.log(`Scraping: ${url}`);
    await page.goto(url, { waitUntil: "networkidle2" });
    await delay(2000);
    
    // Extract data from the table
    const tableData = await page.$$eval('table.tr-table tbody tr, table.datatable tbody tr', rows => {
      return rows.map((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) return null;
        
        const rankCell = cells[0]?.textContent?.trim() || "";
        const teamCell = cells[1]?.textContent?.trim() || "";
        const valueCell = cells[2]?.textContent?.trim() || "";
        
        const rank = parseInt(rankCell) || index + 1;
        const value = parseFloat(valueCell.replace(/[^0-9.-]/g, "")) || 0;
        
        // Clean team name (remove rankings, records, etc.)
        const teamName = teamCell.replace(/\(\d+-\d+\)/, "").replace(/\d+$/, "").trim();
        
        if (!teamName) return null;
        
        return { teamName, value, rank };
      }).filter(t => t !== null);
    });
    
    data.push(...(tableData as TeamRankingsData[]));
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
  }
  
  return data;
}

export async function scrapeTeamRankingsForSport(
  page: Page,
  sport: string
): Promise<Map<string, Partial<InsertTeamStats>>> {
  const teamMap = new Map<string, Partial<InsertTeamStats>>();
  const statUrls = STAT_URLS[sport];
  
  if (!statUrls) {
    console.error(`No stat URLs configured for sport: ${sport}`);
    return teamMap;
  }
  
  for (const [statName, url] of Object.entries(statUrls)) {
    const statData = await scrapeStatPage(page, url);
    
    for (const data of statData) {
      const existing = teamMap.get(data.teamName) || {
        teamName: data.teamName,
        sport,
        splitType: "season",
        source: "teamrankings",
      };
      
      // Map the stat to the correct field
      (existing as any)[statName] = data.value;
      teamMap.set(data.teamName, existing);
    }
    
    // Be respectful to the server
    await delay(1500);
  }
  
  return teamMap;
}

export async function scrapeTeamRankings(
  sports: string[] = ["NFL", "NBA", "CFB", "CBB"]
): Promise<{ success: boolean; teams: InsertTeamStats[]; error?: string }> {
  const allTeams: InsertTeamStats[] = [];
  
  try {
    const browser = await getBrowser();
    const page = await createPage(browser);
    
    for (const sport of sports) {
      console.log(`Scraping TeamRankings for ${sport}...`);
      const teamMap = await scrapeTeamRankingsForSport(page, sport);
      
      // Convert map to array
      for (const teamData of Array.from(teamMap.values())) {
        const fullStats: InsertTeamStats = {
          teamName: teamData.teamName!,
          sport: teamData.sport!,
          splitType: teamData.splitType || "season",
          source: "teamrankings",
          offensivePPP: teamData.offensivePPP || null,
          defensivePPP: teamData.defensivePPP || null,
          offensiveRating: teamData.offensiveRating || null,
          defensiveRating: teamData.defensiveRating || null,
          pace: teamData.pace || null,
          possessionsPerGame: teamData.possessionsPerGame || null,
          opponentPossessionsPerGame: null,
          playsPerGame: null,
          effectiveFieldGoalPct: teamData.effectiveFieldGoalPct || null,
          turnoverPct: teamData.turnoverPct || null,
          offensiveReboundPct: teamData.offensiveReboundPct || null,
          freeThrowRate: null,
          threePointPct: teamData.threePointPct || null,
          threePointRate: null,
          freeThrowPct: null,
          rimFinishingPct: null,
          yardsPerPlay: teamData.yardsPerPlay || null,
          opponentYardsPerPlay: teamData.opponentYardsPerPlay || null,
          redZoneScoringPct: teamData.redZoneScoringPct || null,
          thirdDownConversionPct: teamData.thirdDownConversionPct || null,
          penaltiesPerGame: null,
          kenpomRank: null,
          kenpomAdjustedEfficiency: null,
          kenpomTempo: null,
          kenpomLuck: null,
          strengthOfSchedule: null,
          rawData: teamData,
        };
        allTeams.push(fullStats);
      }
      
      console.log(`Scraped ${teamMap.size} teams for ${sport}`);
    }
    
    await page.close();
    
    return {
      success: true,
      teams: allTeams,
    };
  } catch (error) {
    console.error("TeamRankings scraper error:", error);
    return {
      success: false,
      teams: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Scrape from a specific URL (for Excel cell A1 URLs)
export async function scrapeFromUrl(url: string): Promise<TeamRankingsData[]> {
  try {
    const browser = await getBrowser();
    const page = await createPage(browser);
    
    const data = await scrapeStatPage(page, url);
    
    await page.close();
    return data;
  } catch (error) {
    console.error(`Error scraping URL ${url}:`, error);
    return [];
  }
}
