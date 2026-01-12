import { createHttpClient, delay } from "./http-client";
import type { InsertGame } from "@shared/schema";

interface LeagueGame {
  awayTeam: string;
  homeTeam: string;
  gameDate: Date;
  externalId?: string;
  venue?: string;
  status?: string;
}

export async function scrapeNBASchedule(): Promise<{ success: boolean; games: LeagueGame[]; error?: string }> {
  const games: LeagueGame[] = [];
  
  try {
    const { client } = createHttpClient();
    
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const url = `https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`;
    
    console.log(`Fetching NBA schedule from: ${url}`);
    
    const response = await client.get(url);
    const data = response.data;
    
    if (data?.scoreboard?.games) {
      for (const game of data.scoreboard.games) {
        games.push({
          awayTeam: game.awayTeam?.teamName || game.awayTeam?.teamCity,
          homeTeam: game.homeTeam?.teamName || game.homeTeam?.teamCity,
          gameDate: new Date(game.gameTimeUTC || game.gameEt),
          externalId: game.gameId,
          venue: game.arenaName,
          status: game.gameStatus === 1 ? "scheduled" : game.gameStatus === 2 ? "live" : "final",
        });
      }
    }
    
    console.log(`NBA: Found ${games.length} games for today`);
    return { success: true, games };
  } catch (error: any) {
    console.error("NBA schedule error:", error.message);
    
    try {
      const { client } = createHttpClient();
      const fallbackUrl = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
      console.log(`Trying ESPN fallback: ${fallbackUrl}`);
      
      const response = await client.get(fallbackUrl);
      const data = response.data;
      
      if (data?.events) {
        for (const event of data.events) {
          const competitors = event.competitions?.[0]?.competitors || [];
          const away = competitors.find((c: any) => c.homeAway === "away");
          const home = competitors.find((c: any) => c.homeAway === "home");
          
          if (away && home) {
            games.push({
              awayTeam: away.team?.displayName || away.team?.name,
              homeTeam: home.team?.displayName || home.team?.name,
              gameDate: new Date(event.date),
              externalId: event.id,
              venue: event.competitions?.[0]?.venue?.fullName,
              status: event.status?.type?.name?.toLowerCase() || "scheduled",
            });
          }
        }
      }
      
      console.log(`NBA (ESPN): Found ${games.length} games`);
      return { success: true, games };
    } catch (espnError: any) {
      return { success: false, games: [], error: espnError.message };
    }
  }
}

export async function scrapeNFLSchedule(): Promise<{ success: boolean; games: LeagueGame[]; error?: string }> {
  const games: LeagueGame[] = [];
  
  try {
    const { client } = createHttpClient();
    const url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
    
    console.log(`Fetching NFL schedule from: ${url}`);
    
    const response = await client.get(url);
    const data = response.data;
    
    if (data?.events) {
      for (const event of data.events) {
        const competitors = event.competitions?.[0]?.competitors || [];
        const away = competitors.find((c: any) => c.homeAway === "away");
        const home = competitors.find((c: any) => c.homeAway === "home");
        
        if (away && home) {
          games.push({
            awayTeam: away.team?.displayName || away.team?.name,
            homeTeam: home.team?.displayName || home.team?.name,
            gameDate: new Date(event.date),
            externalId: event.id,
            venue: event.competitions?.[0]?.venue?.fullName,
            status: event.status?.type?.name?.toLowerCase() || "scheduled",
          });
        }
      }
    }
    
    console.log(`NFL: Found ${games.length} games`);
    return { success: true, games };
  } catch (error: any) {
    console.error("NFL schedule error:", error.message);
    return { success: false, games: [], error: error.message };
  }
}

export async function scrapeCFBSchedule(): Promise<{ success: boolean; games: LeagueGame[]; error?: string }> {
  const games: LeagueGame[] = [];
  
  try {
    const { client } = createHttpClient();
    const url = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?limit=100";
    
    console.log(`Fetching CFB schedule from: ${url}`);
    
    const response = await client.get(url);
    const data = response.data;
    
    if (data?.events) {
      for (const event of data.events) {
        const competitors = event.competitions?.[0]?.competitors || [];
        const away = competitors.find((c: any) => c.homeAway === "away");
        const home = competitors.find((c: any) => c.homeAway === "home");
        
        if (away && home) {
          games.push({
            awayTeam: away.team?.displayName || away.team?.name,
            homeTeam: home.team?.displayName || home.team?.name,
            gameDate: new Date(event.date),
            externalId: event.id,
            venue: event.competitions?.[0]?.venue?.fullName,
            status: event.status?.type?.name?.toLowerCase() || "scheduled",
          });
        }
      }
    }
    
    console.log(`CFB: Found ${games.length} games`);
    return { success: true, games };
  } catch (error: any) {
    console.error("CFB schedule error:", error.message);
    return { success: false, games: [], error: error.message };
  }
}

export async function scrapeCBBSchedule(): Promise<{ success: boolean; games: LeagueGame[]; error?: string }> {
  const games: LeagueGame[] = [];
  
  try {
    const { client } = createHttpClient();
    const url = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?limit=100";
    
    console.log(`Fetching CBB schedule from: ${url}`);
    
    const response = await client.get(url);
    const data = response.data;
    
    if (data?.events) {
      for (const event of data.events) {
        const competitors = event.competitions?.[0]?.competitors || [];
        const away = competitors.find((c: any) => c.homeAway === "away");
        const home = competitors.find((c: any) => c.homeAway === "home");
        
        if (away && home) {
          games.push({
            awayTeam: away.team?.displayName || away.team?.name,
            homeTeam: home.team?.displayName || home.team?.name,
            gameDate: new Date(event.date),
            externalId: event.id,
            venue: event.competitions?.[0]?.venue?.fullName,
            status: event.status?.type?.name?.toLowerCase() || "scheduled",
          });
        }
      }
    }
    
    console.log(`CBB: Found ${games.length} games`);
    return { success: true, games };
  } catch (error: any) {
    console.error("CBB schedule error:", error.message);
    return { success: false, games: [], error: error.message };
  }
}

export async function scrapeAllSchedules(): Promise<{
  success: boolean;
  games: { sport: string; data: LeagueGame[] }[];
  errors: string[];
}> {
  const results: { sport: string; data: LeagueGame[] }[] = [];
  const errors: string[] = [];
  
  const [nba, nfl, cfb, cbb] = await Promise.all([
    scrapeNBASchedule(),
    scrapeNFLSchedule(),
    scrapeCFBSchedule(),
    scrapeCBBSchedule(),
  ]);
  
  if (nba.success) results.push({ sport: "NBA", data: nba.games });
  else if (nba.error) errors.push(`NBA: ${nba.error}`);
  
  if (nfl.success) results.push({ sport: "NFL", data: nfl.games });
  else if (nfl.error) errors.push(`NFL: ${nfl.error}`);
  
  if (cfb.success) results.push({ sport: "CFB", data: cfb.games });
  else if (cfb.error) errors.push(`CFB: ${cfb.error}`);
  
  if (cbb.success) results.push({ sport: "CBB", data: cbb.games });
  else if (cbb.error) errors.push(`CBB: ${cbb.error}`);
  
  return {
    success: errors.length === 0,
    games: results,
    errors,
  };
}
