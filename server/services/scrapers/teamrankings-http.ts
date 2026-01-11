import { createHttpClient, parseHtml, delay } from "./http-client";
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

async function scrapeStatPage(client: ReturnType<typeof createHttpClient>["client"], url: string): Promise<TeamRankingsData[]> {
  const data: TeamRankingsData[] = [];
  
  try {
    console.log(`Fetching: ${url}`);
    const response = await client.get(url);
    const $ = parseHtml(response.data);
    
    $("table.tr-table tbody tr, table.datatable tbody tr, table tbody tr").each((index, row) => {
      const cells = $(row).find("td");
      if (cells.length < 3) return;
      
      const rankText = $(cells[0]).text().trim();
      const teamText = $(cells[1]).text().trim();
      const valueText = $(cells[2]).text().trim();
      
      const rank = parseInt(rankText) || index + 1;
      const value = parseFloat(valueText.replace(/[^0-9.-]/g, "")) || 0;
      const teamName = teamText.replace(/\(\d+-\d+\)/, "").replace(/\d+$/, "").trim();
      
      if (teamName && value !== 0) {
        data.push({ teamName, value, rank });
      }
    });
    
    console.log(`Scraped ${data.length} teams from ${url}`);
  } catch (error) {
    console.error(`Error fetching ${url}:`, error instanceof Error ? error.message : error);
  }
  
  return data;
}

async function scrapeTeamRankingsForSport(
  client: ReturnType<typeof createHttpClient>["client"],
  sport: string
): Promise<Map<string, Partial<InsertTeamStats>>> {
  const teamMap = new Map<string, Partial<InsertTeamStats>>();
  const statUrls = STAT_URLS[sport];
  
  if (!statUrls) {
    console.error(`No stat URLs configured for sport: ${sport}`);
    return teamMap;
  }
  
  for (const [statName, url] of Object.entries(statUrls)) {
    const data = await scrapeStatPage(client, url);
    
    for (const item of data) {
      const existing = teamMap.get(item.teamName) || {
        teamName: item.teamName,
        sport,
        splitType: "season",
        source: "teamrankings",
      };
      
      switch (statName) {
        case "offensivePPP":
          existing.offensivePPP = item.value;
          break;
        case "defensivePPP":
          existing.defensivePPP = item.value;
          break;
        case "offensiveRating":
          existing.offensiveRating = item.value;
          break;
        case "defensiveRating":
          existing.defensiveRating = item.value;
          break;
        case "pace":
          existing.pace = item.value;
          break;
        case "yardsPerPlay":
          existing.yardsPerPlay = item.value;
          break;
        case "opponentYardsPerPlay":
          existing.opponentYardsPerPlay = item.value;
          break;
        case "redZoneScoringPct":
          existing.redZoneScoringPct = item.value;
          break;
        case "thirdDownConversionPct":
          existing.thirdDownConversionPct = item.value;
          break;
        case "effectiveFieldGoalPct":
          existing.effectiveFieldGoalPct = item.value;
          break;
        case "turnoverPct":
          existing.turnoverPct = item.value;
          break;
        case "offensiveReboundPct":
          existing.offensiveReboundPct = item.value;
          break;
        case "threePointPct":
          existing.threePointPct = item.value;
          break;
      }
      
      teamMap.set(item.teamName, existing);
    }
    
    await delay(1000);
  }
  
  return teamMap;
}

export async function scrapeTeamRankingsHttp(
  sports: string[] = ["NFL", "NBA", "CFB", "CBB"]
): Promise<{ success: boolean; teams: InsertTeamStats[]; error?: string }> {
  const allTeams: InsertTeamStats[] = [];
  
  try {
    const { client } = createHttpClient();
    
    for (const sport of sports) {
      console.log(`Scraping TeamRankings for ${sport}...`);
      const teamMap = await scrapeTeamRankingsForSport(client, sport);
      
      for (const teamData of Array.from(teamMap.values())) {
        const fullStats: InsertTeamStats = {
          teamName: teamData.teamName!,
          sport: teamData.sport!,
          splitType: teamData.splitType || "season",
          source: teamData.source || "teamrankings",
          offensivePPP: teamData.offensivePPP,
          defensivePPP: teamData.defensivePPP,
          offensiveRating: teamData.offensiveRating,
          defensiveRating: teamData.defensiveRating,
          pace: teamData.pace,
          yardsPerPlay: teamData.yardsPerPlay,
          opponentYardsPerPlay: teamData.opponentYardsPerPlay,
          redZoneScoringPct: teamData.redZoneScoringPct,
          thirdDownConversionPct: teamData.thirdDownConversionPct,
          effectiveFieldGoalPct: teamData.effectiveFieldGoalPct,
          turnoverPct: teamData.turnoverPct,
          offensiveReboundPct: teamData.offensiveReboundPct,
          threePointPct: teamData.threePointPct,
        };
        
        allTeams.push(fullStats);
      }
      
      await delay(2000);
    }
    
    return { success: true, teams: allTeams };
  } catch (error) {
    console.error("TeamRankings scraper error:", error);
    return {
      success: false,
      teams: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
