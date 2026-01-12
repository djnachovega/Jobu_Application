import * as XLSX from "xlsx";
import type { InsertTeamStats, SportType } from "@shared/schema";

interface ParseResult {
  stats: InsertTeamStats[];
  sport: SportType;
  errors: string[];
}

function detectSport(filename: string): SportType {
  const lower = filename.toLowerCase();
  if (lower.includes("nfl")) return "NFL";
  if (lower.includes("nba") && !lower.includes("ncaa")) return "NBA";
  if (lower.includes("ncaa_football") || lower.includes("ncaa football")) return "CFB";
  if (lower.includes("ncaa_hoops") || lower.includes("ncaa hoops") || lower.includes("college_basketball") || lower.includes("cbb")) return "CBB";
  if (lower.includes("cfb") || (lower.includes("football") && lower.includes("college"))) return "CFB";
  return "NFL";
}

function mapSheetNameToStat(sheetName: string): { field: string; isDefensive: boolean } | null {
  const lower = sheetName.toLowerCase();
  
  if (lower.includes("possessions")) return { field: "possessionsPerGame", isDefensive: false };
  if (lower.includes("offensive efficiency")) return { field: "offensiveRating", isDefensive: false };
  if (lower.includes("defensive efficiency")) return { field: "defensiveRating", isDefensive: true };
  if (lower.includes("effective field goal")) return { field: "effectiveFieldGoalPct", isDefensive: lower.includes("opponent") };
  if (lower.includes("turnover percent")) return { field: "turnoverPct", isDefensive: lower.includes("opponent") };
  if (lower.includes("offensive rebound")) return { field: "offensiveReboundPct", isDefensive: false };
  if (lower.includes("defensive rebound")) return { field: "offensiveReboundPct", isDefensive: true };
  if (lower.includes("free throw rate")) return { field: "freeThrowRate", isDefensive: lower.includes("opponent") };
  if (lower.includes("3 point percent") || lower.includes("three point percent")) return { field: "threePointPct", isDefensive: lower.includes("opponent") };
  if (lower.includes("3 point attempt") || lower.includes("three point attempt")) return { field: "threePointRate", isDefensive: false };
  if (lower.includes("strength of schedule")) return { field: "strengthOfSchedule", isDefensive: false };
  if (lower.includes("plays per game")) return { field: "playsPerGame", isDefensive: lower.includes("opponent") };
  if (lower.includes("yards per play")) return { field: "yardsPerPlay", isDefensive: lower.includes("opponent") };
  if (lower.includes("points per play")) return { field: "offensivePPP", isDefensive: lower.includes("opponent") };
  if (lower.includes("red zone")) return { field: "redZoneScoringPct", isDefensive: lower.includes("opponent") };
  if (lower.includes("third down")) return { field: "thirdDownConversionPct", isDefensive: lower.includes("opponent") };
  if (lower.includes("kenpom")) return { field: "kenpomAdjustedEfficiency", isDefensive: false };
  if (lower.includes("penalty")) return { field: "penaltiesPerGame", isDefensive: false };
  
  return null;
}

function parseNumeric(value: any): number | null {
  if (value === null || value === undefined || value === "" || value === "-") {
    return null;
  }
  const str = String(value).replace("%", "").replace(",", "").trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function findHeaderRow(jsonData: any[][]): { headerRowIdx: number, teamColIdx: number, homeColIdx: number, awayColIdx: number } | null {
  for (let rowIdx = 0; rowIdx < Math.min(10, jsonData.length); rowIdx++) {
    const row = jsonData[rowIdx];
    if (!row || !Array.isArray(row)) continue;
    
    let teamColIdx = -1;
    let homeColIdx = -1;
    let awayColIdx = -1;
    
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cellValue = String(row[colIdx] || "").toLowerCase().trim();
      if (cellValue === "team") teamColIdx = colIdx;
      if (cellValue === "home") homeColIdx = colIdx;
      if (cellValue === "away") awayColIdx = colIdx;
    }
    
    if (teamColIdx !== -1 && homeColIdx !== -1 && awayColIdx !== -1) {
      return { headerRowIdx: rowIdx, teamColIdx, homeColIdx, awayColIdx };
    }
  }
  return null;
}

function createEmptyStats(teamName: string, sport: SportType, splitType: string): InsertTeamStats {
  return {
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
}

export async function parseExcelFile(buffer: Buffer, filename: string): Promise<ParseResult> {
  const errors: string[] = [];
  const homeStatsMap = new Map<string, InsertTeamStats>();
  const awayStatsMap = new Map<string, InsertTeamStats>();
  
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sport = detectSport(filename);
    
    for (const sheetName of workbook.SheetNames) {
      if (sheetName.toLowerCase().includes("summary")) continue;
      
      const statMapping = mapSheetNameToStat(sheetName);
      if (!statMapping) continue;
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (jsonData.length < 5) continue;
      
      const headerInfo = findHeaderRow(jsonData);
      if (!headerInfo) {
        errors.push(`Sheet ${sheetName}: Could not find header row with Team/Home/Away columns`);
        continue;
      }
      
      const { headerRowIdx, teamColIdx, homeColIdx, awayColIdx } = headerInfo;
      
      for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !row[teamColIdx]) continue;
        
        const teamName = String(row[teamColIdx]).trim();
        if (!teamName) continue;
        
        const homeValue = parseNumeric(row[homeColIdx]);
        const awayValue = parseNumeric(row[awayColIdx]);
        
        if (!homeStatsMap.has(teamName)) {
          homeStatsMap.set(teamName, createEmptyStats(teamName, sport, "home"));
        }
        if (!awayStatsMap.has(teamName)) {
          awayStatsMap.set(teamName, createEmptyStats(teamName, sport, "away"));
        }
        
        const homeStats = homeStatsMap.get(teamName)!;
        const awayStats = awayStatsMap.get(teamName)!;
        
        const field = statMapping.field as keyof InsertTeamStats;
        if (homeValue !== null) {
          (homeStats as any)[field] = homeValue;
        }
        if (awayValue !== null) {
          (awayStats as any)[field] = awayValue;
        }
      }
    }
    
    const stats = [...homeStatsMap.values(), ...awayStatsMap.values()].filter(s => {
      const values = Object.values(s).filter(v => typeof v === "number" && v !== null);
      return values.length > 0;
    });
    
    return { stats, sport, errors };
  } catch (error) {
    errors.push(`Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`);
    return { stats: [], sport: "NFL", errors };
  }
}
