import { createHttpClient, parseHtml, delay } from "./http-client";

export interface CoversOddsData {
  awayTeam: string;
  homeTeam: string;
  sport: string;
  gameTime: string;
  spreadHome: number | null;
  spreadAway: number | null;
  totalOver: number | null;
  moneylineHome: number | null;
  moneylineAway: number | null;
  openSpreadHome: number | null;
  openTotalOver: number | null;
  matchupUrl: string | null;
}

export interface CoversBettingPercentages {
  awayTeam: string;
  homeTeam: string;
  sport: string;
  spreadAwayTicketPct: number | null;
  spreadHomeTicketPct: number | null;
  spreadAwayMoneyPct: number | null;
  spreadHomeMoneyPct: number | null;
  totalOverTicketPct: number | null;
  totalUnderTicketPct: number | null;
  totalOverMoneyPct: number | null;
  totalUnderMoneyPct: number | null;
}

export interface CoversScraperResult {
  success: boolean;
  odds: CoversOddsData[];
  percentages: CoversBettingPercentages[];
  error?: string;
}

const SPORT_URLS: Record<string, string> = {
  NFL: "https://www.covers.com/sport/football/nfl/odds",
  NBA: "https://www.covers.com/sport/basketball/nba/odds",
  CFB: "https://www.covers.com/sport/football/ncaaf/odds",
  CBB: "https://www.covers.com/sport/basketball/ncaab/odds",
};

const NFL_TEAMS: Record<string, string> = {
  ARI: "Arizona Cardinals", ATL: "Atlanta Falcons", BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills", CAR: "Carolina Panthers", CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals", CLE: "Cleveland Browns", DAL: "Dallas Cowboys",
  DEN: "Denver Broncos", DET: "Detroit Lions", GB: "Green Bay Packers",
  HOU: "Houston Texans", IND: "Indianapolis Colts", JAC: "Jacksonville Jaguars",
  JAX: "Jacksonville Jaguars", KC: "Kansas City Chiefs", LA: "Los Angeles Rams",
  LAC: "Los Angeles Chargers", LAR: "Los Angeles Rams", LV: "Las Vegas Raiders",
  MIA: "Miami Dolphins", MIN: "Minnesota Vikings", NE: "New England Patriots",
  NO: "New Orleans Saints", NYG: "New York Giants", NYJ: "New York Jets",
  OAK: "Las Vegas Raiders", PHI: "Philadelphia Eagles", PIT: "Pittsburgh Steelers",
  SF: "San Francisco 49ers", SEA: "Seattle Seahawks", TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans", WAS: "Washington Commanders", WSH: "Washington Commanders",
};

const NBA_TEAMS: Record<string, string> = {
  ATL: "Atlanta Hawks", BOS: "Boston Celtics", BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets", CHI: "Chicago Bulls", CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks", DEN: "Denver Nuggets", DET: "Detroit Pistons",
  GS: "Golden State Warriors", GSW: "Golden State Warriors", HOU: "Houston Rockets",
  IND: "Indiana Pacers", LA: "Los Angeles Clippers", LAC: "LA Clippers",
  LAL: "Los Angeles Lakers", MEM: "Memphis Grizzlies", MIA: "Miami Heat",
  MIL: "Milwaukee Bucks", MIN: "Minnesota Timberwolves", NOP: "New Orleans Pelicans",
  NO: "New Orleans Pelicans", NY: "New York Knicks", NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder", ORL: "Orlando Magic", PHI: "Philadelphia 76ers",
  PHO: "Phoenix Suns", PHX: "Phoenix Suns", POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings", SA: "San Antonio Spurs", SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors", UTA: "Utah Jazz", UTAH: "Utah Jazz",
  WAS: "Washington Wizards", WASH: "Washington Wizards",
};

function expandTeamName(abbrev: string, sport: string): string {
  const cleaned = abbrev.toUpperCase().trim();
  
  if (sport === "NFL" && NFL_TEAMS[cleaned]) {
    return NFL_TEAMS[cleaned];
  }
  if (sport === "NBA" && NBA_TEAMS[cleaned]) {
    return NBA_TEAMS[cleaned];
  }
  
  return abbrev;
}

function parseSpreadFromCell(text: string): { spread: number | null; odds: number | null } {
  const parts = text.trim().split(/\s+/);
  let spread: number | null = null;
  let spreadOdds: number | null = null;
  
  for (const part of parts) {
    const cleanPart = part.replace(/[^\d.+-]/g, "");
    if (cleanPart.match(/^[+-]?\d+\.?\d*$/)) {
      const num = parseFloat(cleanPart);
      if (spread === null && Math.abs(num) <= 50) {
        spread = num;
      } else if (spreadOdds === null && Math.abs(num) >= 100) {
        spreadOdds = num;
      }
    }
  }
  
  return { spread, odds: spreadOdds };
}

function parseTotalFromCell(text: string): number | null {
  const parts = text.trim().split(/\s+/);
  
  for (const part of parts) {
    const match = part.match(/^[oOuU]?\s*(\d+\.?\d*)$/);
    if (match) {
      const num = parseFloat(match[1]);
      if (num > 30 && num < 300) {
        return num;
      }
    }
    
    const simpleMatch = part.match(/^(\d+\.?\d*)$/);
    if (simpleMatch) {
      const num = parseFloat(simpleMatch[1]);
      if (num > 30 && num < 300) {
        return num;
      }
    }
  }
  
  return null;
}

function parseMoneylineFromCell(text: string): number | null {
  const match = text.match(/([+-]\d{3,})/);
  if (match) {
    return parseInt(match[1]);
  }
  return null;
}

async function scrapeOddsForSport(
  client: ReturnType<typeof createHttpClient>["client"],
  sport: string
): Promise<CoversOddsData[]> {
  const url = SPORT_URLS[sport];
  if (!url) {
    console.log(`No URL configured for sport: ${sport}`);
    return [];
  }

  const odds: CoversOddsData[] = [];

  try {
    console.log(`Fetching Covers odds for ${sport}: ${url}`);
    const response = await client.get(url);
    const $ = parseHtml(response.data);

    const rows = $("tr").toArray();
    
    for (const row of rows) {
      const $row = $(row);
      const firstTd = $row.find("td").first();
      const text = firstTd.text();
      
      const teamLinks = firstTd.find("a[href*='matchup']");
      const strongTags = firstTd.find("strong");
      
      if (strongTags.length < 2) continue;
      
      const awayAbbrev = $(strongTags[0]).text().trim().replace(/[^A-Z]/gi, "");
      const homeAbbrev = $(strongTags[1]).text().trim().replace(/[^A-Z]/gi, "");
      
      if (!awayAbbrev || !homeAbbrev) continue;
      if (awayAbbrev.length < 2 || homeAbbrev.length < 2) continue;
      if (awayAbbrev.length > 4 || homeAbbrev.length > 4) continue;
      
      const awayTeam = expandTeamName(awayAbbrev, sport);
      const homeTeam = expandTeamName(homeAbbrev, sport);
      
      const openingMatch = text.match(/([+-]?\d+\.?\d*)\s*(\d+\.?\d*)/);
      let openSpread: number | null = null;
      let openTotal: number | null = null;
      
      if (openingMatch) {
        const first = parseFloat(openingMatch[1]);
        const second = parseFloat(openingMatch[2]);
        if (Math.abs(first) < 50) openSpread = first;
        if (second > 30 && second < 300) openTotal = second;
      }
      
      const timeMatch = text.match(/(\d{1,2}:\d{2})/);
      const gameTime = timeMatch ? timeMatch[1] : "";
      
      const allCells = $row.find("td").toArray();
      let spreadHome: number | null = null;
      let spreadAway: number | null = null;
      let totalOver: number | null = null;
      let mlHome: number | null = null;
      let mlAway: number | null = null;
      
      for (let i = 1; i < Math.min(allCells.length, 5); i++) {
        const cellText = $(allCells[i]).text();
        const lines = cellText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        
        if (lines.length >= 2) {
          const awaySpreads = parseSpreadFromCell(lines[0]);
          const homeSpreads = parseSpreadFromCell(lines[1]);
          
          if (spreadAway === null && awaySpreads.spread !== null) {
            spreadAway = awaySpreads.spread;
          }
          if (spreadHome === null && homeSpreads.spread !== null) {
            spreadHome = homeSpreads.spread;
          }
          
          if (totalOver === null) {
            const total = parseTotalFromCell(lines[0]);
            if (total !== null) totalOver = total;
          }
          
          if (mlAway === null) {
            mlAway = parseMoneylineFromCell(lines[0]);
          }
          if (mlHome === null) {
            mlHome = parseMoneylineFromCell(lines[1]);
          }
        }
      }
      
      const matchupLink = firstTd.find("a[href*='matchup']").first().attr("href") || null;
      
      if (awayTeam !== awayAbbrev || homeTeam !== homeAbbrev) {
        odds.push({
          awayTeam,
          homeTeam,
          sport,
          gameTime,
          spreadHome,
          spreadAway,
          totalOver,
          moneylineHome: mlHome,
          moneylineAway: mlAway,
          openSpreadHome: openSpread,
          openTotalOver: openTotal,
          matchupUrl: matchupLink,
        });
      }
    }

    console.log(`Scraped ${odds.length} games with valid team names from Covers ${sport}`);
  } catch (error) {
    console.error(`Error scraping Covers ${sport}:`, error instanceof Error ? error.message : error);
  }

  return odds;
}

export async function scrapeCoversOdds(sports?: string[]): Promise<CoversScraperResult> {
  const { client } = createHttpClient();
  const allOdds: CoversOddsData[] = [];
  const sportsToScrape = sports || ["NFL", "NBA"];

  try {
    for (const sport of sportsToScrape) {
      if (!SPORT_URLS[sport]) {
        console.log(`Skipping ${sport} - no URL configured`);
        continue;
      }

      const sportOdds = await scrapeOddsForSport(client, sport);
      allOdds.push(...sportOdds);

      await delay(2000);
    }

    return {
      success: true,
      odds: allOdds,
      percentages: [],
    };
  } catch (error) {
    console.error("Covers scraper error:", error);
    return {
      success: false,
      odds: [],
      percentages: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function scrapeCoversConsensus(sports?: string[]): Promise<{ success: boolean; percentages: CoversBettingPercentages[]; error?: string }> {
  return {
    success: true,
    percentages: [],
  };
}
