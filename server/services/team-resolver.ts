import { db } from "../db";
import { teams, teamAliases, type Team, type InsertTeam, type InsertTeamAlias } from "@shared/schema";
import { eq, and, ilike } from "drizzle-orm";

const COMMON_ALIASES: Record<string, Record<string, string[]>> = {
  NBA: {
    "Los Angeles Lakers": ["Lakers", "LAL", "LA Lakers", "L.A. Lakers"],
    "Los Angeles Clippers": ["Clippers", "LAC", "LA Clippers", "L.A. Clippers"],
    "Golden State Warriors": ["Warriors", "GSW", "Golden State", "GS Warriors"],
    "Boston Celtics": ["Celtics", "BOS", "Boston"],
    "Brooklyn Nets": ["Nets", "BKN", "Brooklyn"],
    "New York Knicks": ["Knicks", "NYK", "NY Knicks", "New York"],
    "Philadelphia 76ers": ["76ers", "Sixers", "PHI", "Philadelphia"],
    "Toronto Raptors": ["Raptors", "TOR", "Toronto"],
    "Chicago Bulls": ["Bulls", "CHI", "Chicago"],
    "Cleveland Cavaliers": ["Cavaliers", "Cavs", "CLE", "Cleveland"],
    "Detroit Pistons": ["Pistons", "DET", "Detroit"],
    "Indiana Pacers": ["Pacers", "IND", "Indiana"],
    "Milwaukee Bucks": ["Bucks", "MIL", "Milwaukee"],
    "Atlanta Hawks": ["Hawks", "ATL", "Atlanta"],
    "Charlotte Hornets": ["Hornets", "CHA", "Charlotte"],
    "Miami Heat": ["Heat", "MIA", "Miami"],
    "Orlando Magic": ["Magic", "ORL", "Orlando"],
    "Washington Wizards": ["Wizards", "WAS", "Washington"],
    "Denver Nuggets": ["Nuggets", "DEN", "Denver"],
    "Minnesota Timberwolves": ["Timberwolves", "Wolves", "MIN", "Minnesota"],
    "Oklahoma City Thunder": ["Thunder", "OKC", "Oklahoma City"],
    "Portland Trail Blazers": ["Trail Blazers", "Blazers", "POR", "Portland"],
    "Utah Jazz": ["Jazz", "UTA", "Utah"],
    "Dallas Mavericks": ["Mavericks", "Mavs", "DAL", "Dallas"],
    "Houston Rockets": ["Rockets", "HOU", "Houston"],
    "Memphis Grizzlies": ["Grizzlies", "MEM", "Memphis"],
    "New Orleans Pelicans": ["Pelicans", "NOP", "New Orleans"],
    "San Antonio Spurs": ["Spurs", "SAS", "San Antonio"],
    "Phoenix Suns": ["Suns", "PHX", "Phoenix"],
    "Sacramento Kings": ["Kings", "SAC", "Sacramento"],
  },
  NFL: {
    "Arizona Cardinals": ["Cardinals", "ARI", "Arizona"],
    "Atlanta Falcons": ["Falcons", "ATL", "Atlanta"],
    "Baltimore Ravens": ["Ravens", "BAL", "Baltimore"],
    "Buffalo Bills": ["Bills", "BUF", "Buffalo"],
    "Carolina Panthers": ["Panthers", "CAR", "Carolina"],
    "Chicago Bears": ["Bears", "CHI", "Chicago"],
    "Cincinnati Bengals": ["Bengals", "CIN", "Cincinnati"],
    "Cleveland Browns": ["Browns", "CLE", "Cleveland"],
    "Dallas Cowboys": ["Cowboys", "DAL", "Dallas"],
    "Denver Broncos": ["Broncos", "DEN", "Denver"],
    "Detroit Lions": ["Lions", "DET", "Detroit"],
    "Green Bay Packers": ["Packers", "GB", "Green Bay"],
    "Houston Texans": ["Texans", "HOU", "Houston"],
    "Indianapolis Colts": ["Colts", "IND", "Indianapolis"],
    "Jacksonville Jaguars": ["Jaguars", "Jags", "JAX", "Jacksonville"],
    "Kansas City Chiefs": ["Chiefs", "KC", "Kansas City"],
    "Las Vegas Raiders": ["Raiders", "LV", "Las Vegas", "Oakland Raiders"],
    "Los Angeles Chargers": ["Chargers", "LAC", "LA Chargers"],
    "Los Angeles Rams": ["Rams", "LAR", "LA Rams"],
    "Miami Dolphins": ["Dolphins", "MIA", "Miami"],
    "Minnesota Vikings": ["Vikings", "MIN", "Minnesota"],
    "New England Patriots": ["Patriots", "Pats", "NE", "New England"],
    "New Orleans Saints": ["Saints", "NO", "New Orleans"],
    "New York Giants": ["Giants", "NYG", "NY Giants"],
    "New York Jets": ["Jets", "NYJ", "NY Jets"],
    "Philadelphia Eagles": ["Eagles", "PHI", "Philadelphia"],
    "Pittsburgh Steelers": ["Steelers", "PIT", "Pittsburgh"],
    "San Francisco 49ers": ["49ers", "Niners", "SF", "San Francisco"],
    "Seattle Seahawks": ["Seahawks", "SEA", "Seattle"],
    "Tampa Bay Buccaneers": ["Buccaneers", "Bucs", "TB", "Tampa Bay"],
    "Tennessee Titans": ["Titans", "TEN", "Tennessee"],
    "Washington Commanders": ["Commanders", "WAS", "Washington"],
  },
};

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export async function resolveTeamName(
  name: string,
  sport: string
): Promise<Team | null> {
  const normalized = normalizeTeamName(name);
  
  const exactMatch = await db
    .select()
    .from(teams)
    .where(and(
      ilike(teams.name, name),
      eq(teams.sport, sport)
    ))
    .limit(1);
  
  if (exactMatch.length > 0) return exactMatch[0];
  
  const aliasMatch = await db
    .select({ team: teams })
    .from(teamAliases)
    .innerJoin(teams, eq(teamAliases.teamId, teams.id))
    .where(and(
      ilike(teamAliases.alias, name),
      eq(teamAliases.sport, sport)
    ))
    .limit(1);
  
  if (aliasMatch.length > 0) return aliasMatch[0].team;
  
  const allTeams = await db
    .select()
    .from(teams)
    .where(eq(teams.sport, sport));
  
  let bestMatch: Team | null = null;
  let bestDistance = Infinity;
  
  for (const team of allTeams) {
    const teamNormalized = normalizeTeamName(team.name);
    const distance = levenshteinDistance(normalized, teamNormalized);
    
    if (distance < bestDistance && distance <= 3) {
      bestDistance = distance;
      bestMatch = team;
    }
    
    const shortNormalized = normalizeTeamName(team.shortName);
    const shortDistance = levenshteinDistance(normalized, shortNormalized);
    
    if (shortDistance < bestDistance && shortDistance <= 2) {
      bestDistance = shortDistance;
      bestMatch = team;
    }
  }
  
  return bestMatch;
}

export async function getOrCreateTeam(
  name: string,
  sport: string,
  additionalData?: Partial<InsertTeam>
): Promise<Team> {
  const existing = await resolveTeamName(name, sport);
  if (existing) return existing;
  
  const shortName = name.split(" ").pop() || name;
  
  const [newTeam] = await db
    .insert(teams)
    .values({
      name,
      shortName,
      sport,
      ...additionalData,
    })
    .returning();
  
  await db.insert(teamAliases).values({
    teamId: newTeam.id,
    alias: name,
    sport,
    source: "auto",
  });
  
  return newTeam;
}

export async function addTeamAlias(
  teamId: number,
  alias: string,
  sport: string,
  source: string = "manual"
): Promise<void> {
  const existing = await db
    .select()
    .from(teamAliases)
    .where(and(
      eq(teamAliases.teamId, teamId),
      ilike(teamAliases.alias, alias)
    ))
    .limit(1);
  
  if (existing.length === 0) {
    await db.insert(teamAliases).values({
      teamId,
      alias,
      sport,
      source,
    });
  }
}

export async function seedCommonAliases(): Promise<number> {
  let count = 0;
  
  for (const [sport, teams] of Object.entries(COMMON_ALIASES)) {
    for (const [canonicalName, aliases] of Object.entries(teams)) {
      const team = await getOrCreateTeam(canonicalName, sport);
      
      for (const alias of aliases) {
        await addTeamAlias(team.id, alias, sport, "seed");
        count++;
      }
    }
  }
  
  return count;
}

export async function importTeamFromExcel(
  teamName: string,
  sport: string
): Promise<Team> {
  const team = await getOrCreateTeam(teamName, sport);
  await addTeamAlias(team.id, teamName, sport, "excel");
  return team;
}
