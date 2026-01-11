import * as XLSX from "xlsx";
import type { InsertTeamStats, SportType } from "@shared/schema";

interface ParseResult {
  stats: InsertTeamStats[];
  sport: SportType;
  errors: string[];
}

// Detect sport type from filename
function detectSport(filename: string): SportType {
  const lower = filename.toLowerCase();
  if (lower.includes("nfl") || lower.includes("football")) return "NFL";
  if (lower.includes("nba")) return "NBA";
  if (lower.includes("cfb") || lower.includes("college_football")) return "CFB";
  if (lower.includes("cbb") || lower.includes("college_basketball")) return "CBB";
  
  // Default based on content patterns
  return "NFL";
}

// Detect split type from sheet name or filename
function detectSplitType(sheetName: string, filename: string): string {
  const combined = `${sheetName} ${filename}`.toLowerCase();
  if (combined.includes("home")) return "home";
  if (combined.includes("away")) return "away";
  if (combined.includes("last3") || combined.includes("last 3")) return "last3";
  if (combined.includes("last5") || combined.includes("last 5")) return "last5";
  if (combined.includes("last10") || combined.includes("last 10")) return "last10";
  return "season";
}

// Normalize column names to our schema
function normalizeColumn(col: string): string {
  const lower = col.toLowerCase().trim();
  
  // Team name variations
  if (lower === "team" || lower === "name" || lower === "team name") return "teamName";
  
  // Efficiency metrics
  if (lower === "ppp" || lower === "points per possession" || lower === "off ppp") return "offensivePPP";
  if (lower === "def ppp" || lower === "opp ppp" || lower === "def points per possession") return "defensivePPP";
  if (lower === "ortg" || lower === "offensive rating" || lower === "off rtg") return "offensiveRating";
  if (lower === "drtg" || lower === "defensive rating" || lower === "def rtg") return "defensiveRating";
  
  // Pace metrics
  if (lower === "pace" || lower === "tempo") return "pace";
  if (lower === "poss" || lower === "possessions" || lower === "poss/g") return "possessionsPerGame";
  if (lower === "plays" || lower === "plays/g" || lower === "plays per game") return "playsPerGame";
  
  // Four factors
  if (lower === "efg%" || lower === "efg" || lower === "effective fg%") return "effectiveFieldGoalPct";
  if (lower === "tov%" || lower === "to%" || lower === "turnover%") return "turnoverPct";
  if (lower === "orb%" || lower === "oreb%" || lower === "offensive rebound%") return "offensiveReboundPct";
  if (lower === "ftr" || lower === "ft rate" || lower === "free throw rate") return "freeThrowRate";
  
  // Shooting
  if (lower === "3p%" || lower === "3pt%" || lower === "three point%") return "threePointPct";
  if (lower === "3par" || lower === "3pt rate" || lower === "three point rate") return "threePointRate";
  if (lower === "ft%" || lower === "free throw%") return "freeThrowPct";
  
  // Football specific
  if (lower === "ypp" || lower === "yards per play") return "yardsPerPlay";
  if (lower === "opp ypp" || lower === "def ypp") return "opponentYardsPerPlay";
  if (lower === "rz%" || lower === "red zone%" || lower === "rz scoring%") return "redZoneScoringPct";
  if (lower === "3rd%" || lower === "third down%" || lower === "3rd down%") return "thirdDownConversionPct";
  if (lower === "pen/g" || lower === "penalties" || lower === "penalties per game") return "penaltiesPerGame";
  
  // KenPom
  if (lower === "rank" || lower === "kenpom rank") return "kenpomRank";
  if (lower === "adjem" || lower === "adj em" || lower === "adjusted efficiency margin") return "kenpomAdjustedEfficiency";
  if (lower === "adj tempo" || lower === "kenpom tempo") return "kenpomTempo";
  if (lower === "luck") return "kenpomLuck";
  
  // SoS
  if (lower === "sos" || lower === "strength of schedule") return "strengthOfSchedule";
  
  return col;
}

// Parse numeric value
function parseNumeric(value: any): number | null {
  if (value === null || value === undefined || value === "" || value === "-") {
    return null;
  }
  
  const str = String(value).replace("%", "").replace(",", "").trim();
  const num = parseFloat(str);
  
  return isNaN(num) ? null : num;
}

export async function parseExcelFile(buffer: Buffer, filename: string): Promise<ParseResult> {
  const errors: string[] = [];
  const stats: InsertTeamStats[] = [];
  
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sport = detectSport(filename);
    
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (jsonData.length < 2) {
        errors.push(`Sheet ${sheetName}: Not enough data rows`);
        continue;
      }
      
      // First row is headers
      const headers = jsonData[0].map((h: any) => normalizeColumn(String(h || "")));
      const teamNameIdx = headers.findIndex((h: string) => h === "teamName");
      
      if (teamNameIdx === -1) {
        errors.push(`Sheet ${sheetName}: Could not find team name column`);
        continue;
      }
      
      const splitType = detectSplitType(sheetName, filename);
      
      // Process data rows
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !row[teamNameIdx]) continue;
        
        const teamName = String(row[teamNameIdx]).trim();
        if (!teamName) continue;
        
        const teamStats: InsertTeamStats = {
          teamName,
          sport,
          splitType,
          source: "excel",
          offensivePPP: null,
          defensivePPP: null,
          offensiveRating: null,
          defensiveRating: null,
          pace: null,
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
          kenpomRank: null,
          kenpomAdjustedEfficiency: null,
          kenpomTempo: null,
          kenpomLuck: null,
          strengthOfSchedule: null,
          rawData: {},
        };
        
        // Map columns to stats
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const value = row[j];
          
          if (header === "teamName" || !header) continue;
          
          const numValue = parseNumeric(value);
          
          switch (header) {
            case "offensivePPP":
              teamStats.offensivePPP = numValue;
              break;
            case "defensivePPP":
              teamStats.defensivePPP = numValue;
              break;
            case "offensiveRating":
              teamStats.offensiveRating = numValue;
              break;
            case "defensiveRating":
              teamStats.defensiveRating = numValue;
              break;
            case "pace":
              teamStats.pace = numValue;
              break;
            case "possessionsPerGame":
              teamStats.possessionsPerGame = numValue;
              break;
            case "playsPerGame":
              teamStats.playsPerGame = numValue;
              break;
            case "effectiveFieldGoalPct":
              teamStats.effectiveFieldGoalPct = numValue;
              break;
            case "turnoverPct":
              teamStats.turnoverPct = numValue;
              break;
            case "offensiveReboundPct":
              teamStats.offensiveReboundPct = numValue;
              break;
            case "freeThrowRate":
              teamStats.freeThrowRate = numValue;
              break;
            case "threePointPct":
              teamStats.threePointPct = numValue;
              break;
            case "threePointRate":
              teamStats.threePointRate = numValue;
              break;
            case "freeThrowPct":
              teamStats.freeThrowPct = numValue;
              break;
            case "yardsPerPlay":
              teamStats.yardsPerPlay = numValue;
              break;
            case "opponentYardsPerPlay":
              teamStats.opponentYardsPerPlay = numValue;
              break;
            case "redZoneScoringPct":
              teamStats.redZoneScoringPct = numValue;
              break;
            case "thirdDownConversionPct":
              teamStats.thirdDownConversionPct = numValue;
              break;
            case "penaltiesPerGame":
              teamStats.penaltiesPerGame = numValue;
              break;
            case "kenpomRank":
              teamStats.kenpomRank = numValue !== null ? Math.round(numValue) : null;
              break;
            case "kenpomAdjustedEfficiency":
              teamStats.kenpomAdjustedEfficiency = numValue;
              break;
            case "kenpomTempo":
              teamStats.kenpomTempo = numValue;
              break;
            case "kenpomLuck":
              teamStats.kenpomLuck = numValue;
              break;
            case "strengthOfSchedule":
              teamStats.strengthOfSchedule = numValue;
              break;
            default:
              // Store unrecognized columns in rawData
              if (value !== null && value !== undefined && value !== "") {
                (teamStats.rawData as any)[header] = value;
              }
          }
        }
        
        stats.push(teamStats);
      }
    }
    
    return { stats, sport, errors };
  } catch (error) {
    errors.push(`Failed to parse file: ${error instanceof Error ? error.message : "Unknown error"}`);
    return { stats: [], sport: "NFL", errors };
  }
}
