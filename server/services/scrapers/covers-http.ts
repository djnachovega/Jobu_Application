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

    const matchupSections = $("table.covers-CoversMatchups-matches, .covers-CoversMatchups").toArray();
    
    $("tr").each((_, row) => {
      const $row = $(row);
      const text = $row.text();
      
      const strongTags = $row.find("strong").toArray();
      if (strongTags.length < 2) return;
      
      const awayAbbrev = $(strongTags[0]).text().trim().replace(/[^A-Z]/gi, "").toUpperCase();
      const homeAbbrev = $(strongTags[1]).text().trim().replace(/[^A-Z]/gi, "").toUpperCase();
      
      if (!awayAbbrev || !homeAbbrev) return;
      if (awayAbbrev.length < 2 || homeAbbrev.length < 2) return;
      if (awayAbbrev.length > 4 || homeAbbrev.length > 4) return;
      
      const awayTeam = expandTeamName(awayAbbrev, sport);
      const homeTeam = expandTeamName(homeAbbrev, sport);
      
      if (awayTeam === awayAbbrev && homeTeam === homeAbbrev) return;
      
      let spreadHome: number | null = null;
      let spreadAway: number | null = null;
      let totalOver: number | null = null;
      let mlHome: number | null = null;
      let mlAway: number | null = null;
      let openSpread: number | null = null;
      let openTotal: number | null = null;
      
      $row.find("a[data-betslip-side='away']").each((_, el) => {
        const linkText = $(el).text().trim();
        const spreadMatch = linkText.match(/^([+-]?\d+\.?\d*)/);
        if (spreadMatch && spreadAway === null) {
          const val = parseFloat(spreadMatch[1]);
          if (Math.abs(val) <= 50) spreadAway = val;
        }
      });
      
      $row.find("a[data-betslip-side='home']").each((_, el) => {
        const linkText = $(el).text().trim();
        const spreadMatch = linkText.match(/^([+-]?\d+\.?\d*)/);
        if (spreadMatch && spreadHome === null) {
          const val = parseFloat(spreadMatch[1]);
          if (Math.abs(val) <= 50) spreadHome = val;
        }
      });
      
      $row.find("td[data-type='spread'] a").each((_, el) => {
        const linkText = $(el).text().trim();
        const spreadMatch = linkText.match(/^([+-]?\d+\.?\d*)/);
        if (spreadMatch) {
          const val = parseFloat(spreadMatch[1]);
          if (Math.abs(val) <= 50) {
            const side = $(el).attr("data-betslip-game");
            if (side === "away" && spreadAway === null) spreadAway = val;
            if (side === "home" && spreadHome === null) spreadHome = val;
          }
        }
      });
      
      $row.find(".opening-lines-div .away-cell .__american, .opening-lines-div .away-cell span").each((_, el) => {
        const txt = $(el).text().trim();
        const match = txt.match(/^([+-]?\d+\.?\d*)$/);
        if (match && openSpread === null) {
          const val = parseFloat(match[1]);
          if (Math.abs(val) <= 50) openSpread = val;
        }
      });
      
      $row.find("td[data-type='total'] a, a[data-betslip-url*='total']").each((_, el) => {
        const linkText = $(el).text().trim();
        const totalMatch = linkText.match(/^[oOuU]?\s*(\d+\.?\d*)/);
        if (totalMatch && totalOver === null) {
          const val = parseFloat(totalMatch[1]);
          if (val > 30 && val < 300) totalOver = val;
        }
      });
      
      $row.find("td[data-type='moneyline'] a, a[data-betslip-url*='moneyline']").each((_, el) => {
        const linkText = $(el).text().trim();
        const mlMatch = linkText.match(/([+-]\d{3,})/);
        if (mlMatch) {
          const val = parseInt(mlMatch[1]);
          const side = $(el).attr("data-betslip-game");
          if (side === "away" && mlAway === null) mlAway = val;
          if (side === "home" && mlHome === null) mlHome = val;
        }
      });
      
      const timeMatch = text.match(/(\d{1,2}:\d{2})/);
      const gameTime = timeMatch ? timeMatch[1] : "";
      
      const matchupLink = $row.find("a[href*='matchup']").first().attr("href") || null;
      
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
    });

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

async function scrapeMatchupPercentages(
  client: ReturnType<typeof createHttpClient>["client"],
  matchupUrl: string,
  awayTeam: string,
  homeTeam: string,
  sport: string
): Promise<CoversBettingPercentages | null> {
  try {
    const fullUrl = matchupUrl.startsWith("http") ? matchupUrl : `https://www.covers.com${matchupUrl}`;
    const response = await client.get(fullUrl);
    const $ = parseHtml(response.data);
    
    let spreadAwayTicketPct: number | null = null;
    let spreadHomeTicketPct: number | null = null;
    let spreadAwayMoneyPct: number | null = null;
    let spreadHomeMoneyPct: number | null = null;
    let totalOverTicketPct: number | null = null;
    let totalUnderTicketPct: number | null = null;
    let totalOverMoneyPct: number | null = null;
    let totalUnderMoneyPct: number | null = null;

    const pageText = $("body").text();
    
    const spreadSection = pageText.match(/Spread[\s\S]*?(\d{1,3})%[\s\S]*?(\d{1,3})%/i);
    if (spreadSection) {
      spreadAwayTicketPct = parseInt(spreadSection[1]);
      spreadHomeTicketPct = parseInt(spreadSection[2]);
    }
    
    const totalSection = pageText.match(/Total[\s\S]*?Over[\s\S]*?(\d{1,3})%[\s\S]*?Under[\s\S]*?(\d{1,3})%/i);
    if (totalSection) {
      totalOverTicketPct = parseInt(totalSection[1]);
      totalUnderTicketPct = parseInt(totalSection[2]);
    }

    $("div, section").each((_, el) => {
      const text = $(el).text();
      
      const spreadMatch = text.match(/(?:Spread|ATS)[\s\S]*?(\d{1,3})%[\s\S]*?(\d{1,3})%/i);
      if (spreadMatch && !spreadAwayTicketPct) {
        spreadAwayTicketPct = parseInt(spreadMatch[1]);
        spreadHomeTicketPct = parseInt(spreadMatch[2]);
      }
      
      const totalMatch = text.match(/(?:Total|O\/U)[\s\S]*?(\d{1,3})%[\s\S]*?(\d{1,3})%/i);
      if (totalMatch && !totalOverTicketPct) {
        totalOverTicketPct = parseInt(totalMatch[1]);
        totalUnderTicketPct = parseInt(totalMatch[2]);
      }
      
      const moneyMatch = text.match(/Money[\s\S]*?(\d{1,3})%[\s\S]*?(\d{1,3})%/i);
      if (moneyMatch) {
        spreadAwayMoneyPct = parseInt(moneyMatch[1]);
        spreadHomeMoneyPct = parseInt(moneyMatch[2]);
      }
    });

    if (spreadAwayTicketPct || totalOverTicketPct) {
      return {
        awayTeam,
        homeTeam,
        sport,
        spreadAwayTicketPct,
        spreadHomeTicketPct,
        spreadAwayMoneyPct,
        spreadHomeMoneyPct,
        totalOverTicketPct,
        totalUnderTicketPct,
        totalOverMoneyPct,
        totalUnderMoneyPct,
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error scraping matchup percentages:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function scrapeCoversConsensus(sports?: string[]): Promise<{ success: boolean; percentages: CoversBettingPercentages[]; error?: string }> {
  const { client } = createHttpClient();
  const percentages: CoversBettingPercentages[] = [];
  const sportsToScrape = sports || ["NFL", "NBA"];
  
  try {
    const oddsResult = await scrapeCoversOdds(sportsToScrape);
    if (!oddsResult.success) {
      return { success: false, percentages: [], error: oddsResult.error };
    }
    
    const gamesWithUrls = oddsResult.odds.filter(o => o.matchupUrl);
    const limitedGames = gamesWithUrls.slice(0, 10);
    
    for (const game of limitedGames) {
      if (!game.matchupUrl) continue;
      
      const pct = await scrapeMatchupPercentages(client, game.matchupUrl, game.awayTeam, game.homeTeam, game.sport);
      if (pct) {
        percentages.push(pct);
      }
      
      await delay(1500);
    }
    
    console.log(`Scraped betting percentages for ${percentages.length} games`);
    return { success: true, percentages };
  } catch (error) {
    console.error("Covers consensus scraper error:", error);
    return {
      success: false,
      percentages: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
