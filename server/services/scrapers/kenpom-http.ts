import { createHttpClient, parseHtml, delay } from "./http-client";
import type { InsertTeamStats } from "@shared/schema";

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

async function loginToKenPom(
  client: ReturnType<typeof createHttpClient>["client"],
  email: string,
  password: string
): Promise<boolean> {
  try {
    console.log("Logging into KenPom...");
    
    const loginPageResponse = await client.get("https://kenpom.com/");
    const $ = parseHtml(loginPageResponse.data);
    
    const loginResponse = await client.post(
      "https://kenpom.com/handler_accountv2.php",
      new URLSearchParams({
        email,
        password,
        submit: "Login",
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Origin": "https://kenpom.com",
          "Referer": "https://kenpom.com/",
        },
      }
    );
    
    const responseHtml = typeof loginResponse.data === "string" ? loginResponse.data : "";
    const success = responseHtml.includes("logout") || responseHtml.includes("Log out") || loginResponse.status === 200;
    
    console.log("KenPom login:", success ? "Success" : "Failed");
    return success;
  } catch (error: any) {
    console.error("KenPom login error:", error.message);
    return false;
  }
}

async function scrapeTeamRatings(
  client: ReturnType<typeof createHttpClient>["client"]
): Promise<KenPomTeamData[]> {
  const teams: KenPomTeamData[] = [];
  
  try {
    console.log("Scraping KenPom team ratings...");
    const response = await client.get("https://kenpom.com/");
    const $ = parseHtml(response.data);
    
    $("table#ratings-table tbody tr, table tbody tr").each((_, row) => {
      const $row = $(row);
      const cells = $row.find("td");
      
      if (cells.length < 10) return;
      
      const getText = (idx: number) => $(cells[idx]).text().trim();
      const getNumber = (idx: number) => {
        const text = getText(idx);
        const num = parseFloat(text.replace(/[^0-9.-]/g, ""));
        return isNaN(num) ? 0 : num;
      };
      
      const teamName = getText(1).replace(/[0-9]+$/, "").trim();
      if (!teamName) return;
      
      teams.push({
        rank: getNumber(0),
        teamName,
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
      });
    });
    
    console.log(`Scraped ${teams.length} teams from KenPom`);
  } catch (error) {
    console.error("Error scraping KenPom:", error instanceof Error ? error.message : error);
  }
  
  return teams;
}

export async function scrapeKenPomHttp(): Promise<{ success: boolean; teams: InsertTeamStats[]; error?: string }> {
  const email = process.env.KENPOM_EMAIL;
  const password = process.env.KENPOM_PASSWORD;
  
  if (!email || !password) {
    return {
      success: false,
      teams: [],
      error: "KenPom credentials not configured. Please add KENPOM_EMAIL and KENPOM_PASSWORD secrets.",
    };
  }
  
  try {
    const { client } = createHttpClient();
    
    const loggedIn = await loginToKenPom(client, email, password);
    if (!loggedIn) {
      return {
        success: false,
        teams: [],
        error: "Failed to login to KenPom. Please check your credentials.",
      };
    }
    
    const teamData = await scrapeTeamRatings(client);
    
    const teams: InsertTeamStats[] = teamData.map(team => ({
      teamName: team.teamName,
      sport: "CBB",
      splitType: "season",
      source: "kenpom",
      offensiveRating: team.offensiveRating,
      defensiveRating: team.defensiveRating,
      pace: team.tempo,
      powerRating: team.adjustedEfficiencyMargin,
      strengthOfSchedule: team.strengthOfSchedule,
      rawData: team as any,
    }));
    
    return { success: true, teams };
  } catch (error) {
    console.error("KenPom scraper error:", error);
    return {
      success: false,
      teams: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
