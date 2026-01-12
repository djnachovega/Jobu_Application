import { db } from "./db";
import { eq, and, desc, gte, lte, inArray, sql } from "drizzle-orm";
import {
  type User,
  type InsertUser,
  type Team,
  type InsertTeam,
  type Game,
  type InsertGame,
  type Odds,
  type InsertOdds,
  type LineMovement,
  type InsertLineMovement,
  type BettingPercentage,
  type InsertBettingPercentage,
  type TeamStats,
  type InsertTeamStats,
  type Projection,
  type InsertProjection,
  type Opportunity,
  type InsertOpportunity,
  type RlmSignal,
  type InsertRlmSignal,
  type BacktestResult,
  type InsertBacktestResult,
  type DataSource,
  type InsertDataSource,
  type PatternDiscovery,
  type InsertPatternDiscovery,
  users,
  teams,
  games,
  odds,
  lineMovements,
  bettingPercentages,
  teamStats,
  projections,
  opportunities,
  rlmSignals,
  backtestResults,
  dataSources,
  patternDiscoveries,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Teams
  getTeams(sport?: string): Promise<Team[]>;
  getTeamByName(name: string, sport: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;

  // Games
  getGames(filters?: { sports?: string[]; date?: Date }): Promise<Game[]>;
  getGameById(id: number): Promise<Game | undefined>;
  getGamesToday(sports?: string[]): Promise<Game[]>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: number, game: Partial<InsertGame>): Promise<Game | undefined>;
  findOrCreateGame(game: InsertGame): Promise<Game>;

  // Odds
  getOddsForGame(gameId: number): Promise<Odds[]>;
  getLatestOddsForGame(gameId: number): Promise<Odds | undefined>;
  createOdds(oddsData: InsertOdds): Promise<Odds>;

  // Line Movements
  getLineMovements(gameId: number): Promise<LineMovement[]>;
  createLineMovement(movement: InsertLineMovement): Promise<LineMovement>;

  // Betting Percentages
  getBettingPercentages(gameId: number): Promise<BettingPercentage[]>;
  createBettingPercentage(pct: InsertBettingPercentage): Promise<BettingPercentage>;

  // Team Stats
  getTeamStats(filters?: { teamId?: number; teamName?: string; sport?: string; splitType?: string }): Promise<TeamStats[]>;
  createTeamStats(stats: InsertTeamStats): Promise<TeamStats>;
  upsertTeamStats(stats: InsertTeamStats): Promise<TeamStats>;

  // Projections
  getProjectionForGame(gameId: number): Promise<Projection | undefined>;
  getProjections(gameIds?: number[]): Promise<Projection[]>;
  createProjection(projection: InsertProjection): Promise<Projection>;

  // Opportunities
  getOpportunities(filters?: { sports?: string[]; confidence?: string; status?: string }): Promise<Opportunity[]>;
  getOpportunityById(id: number): Promise<Opportunity | undefined>;
  createOpportunity(opp: InsertOpportunity): Promise<Opportunity>;
  updateOpportunity(id: number, opp: Partial<InsertOpportunity>): Promise<Opportunity | undefined>;

  // RLM Signals
  getRlmSignals(filters?: { sports?: string[]; date?: Date }): Promise<RlmSignal[]>;
  createRlmSignal(signal: InsertRlmSignal): Promise<RlmSignal>;

  // Backtest Results
  getBacktestResults(): Promise<BacktestResult[]>;
  createBacktestResult(result: InsertBacktestResult): Promise<BacktestResult>;

  // Data Sources
  getDataSources(): Promise<DataSource[]>;
  getDataSourceByName(name: string): Promise<DataSource | undefined>;
  createDataSource(source: InsertDataSource): Promise<DataSource>;
  updateDataSource(name: string, source: Partial<InsertDataSource>): Promise<DataSource | undefined>;

  // Pattern Discoveries
  getPatternDiscoveries(filters?: { sports?: string[]; active?: boolean }): Promise<PatternDiscovery[]>;
  createPatternDiscovery(pattern: InsertPatternDiscovery): Promise<PatternDiscovery>;

  // Dashboard Stats
  getDashboardStats(sports?: string[]): Promise<{
    totalOpportunities: number;
    highConfidenceCount: number;
    rlmSignalsToday: number;
    gamesWithEdge: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  // Teams
  async getTeams(sport?: string): Promise<Team[]> {
    if (sport) {
      return db.select().from(teams).where(eq(teams.sport, sport));
    }
    return db.select().from(teams);
  }

  async getTeamByName(name: string, sport: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams)
      .where(and(eq(teams.name, name), eq(teams.sport, sport)));
    return team;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [created] = await db.insert(teams).values(team).returning();
    return created;
  }

  // Games
  async getGames(filters?: { sports?: string[]; date?: Date }): Promise<Game[]> {
    let query = db.select().from(games);
    
    if (filters?.sports && filters.sports.length > 0) {
      query = query.where(inArray(games.sport, filters.sports)) as typeof query;
    }
    
    return query.orderBy(desc(games.gameDate));
  }

  async getGameById(id: number): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game;
  }

  async getGamesToday(sports?: string[]): Promise<Game[]> {
    // Get current date in Eastern timezone (EST = UTC-5)
    const now = new Date();
    // Convert to Eastern by subtracting 5 hours from UTC
    const easternNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    
    // Get start of today in Eastern time (midnight Eastern)
    const todayEasternMidnight = new Date(easternNow);
    todayEasternMidnight.setUTCHours(0, 0, 0, 0);
    
    // Convert Eastern midnight back to UTC (add 5 hours)
    // Midnight Eastern = 5am UTC
    const todayStartUtc = new Date(todayEasternMidnight.getTime() + 5 * 60 * 60 * 1000);
    const tomorrowStartUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000);
    
    console.log(`getGamesToday: Eastern date=${easternNow.toISOString().split('T')[0]}, UTC range: ${todayStartUtc.toISOString()} to ${tomorrowStartUtc.toISOString()}`);

    let conditions = and(
      gte(games.gameDate, todayStartUtc),
      lte(games.gameDate, tomorrowStartUtc)
    );

    if (sports && sports.length > 0) {
      conditions = and(conditions, inArray(games.sport, sports));
    }

    return db.select().from(games)
      .where(conditions)
      .orderBy(games.gameDate);
  }

  async createGame(game: InsertGame): Promise<Game> {
    const [created] = await db.insert(games).values(game).returning();
    return created;
  }

  async updateGame(id: number, game: Partial<InsertGame>): Promise<Game | undefined> {
    const [updated] = await db.update(games)
      .set({ ...game, updatedAt: new Date() })
      .where(eq(games.id, id))
      .returning();
    return updated;
  }

  async findOrCreateGame(game: InsertGame): Promise<Game> {
    // Look for existing game with same teams and date (within same day)
    const gameDate = game.gameDate;
    const startOfDay = new Date(gameDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [existing] = await db.select().from(games)
      .where(and(
        eq(games.awayTeamName, game.awayTeamName),
        eq(games.homeTeamName, game.homeTeamName),
        eq(games.sport, game.sport),
        gte(games.gameDate, startOfDay),
        lte(games.gameDate, endOfDay)
      ))
      .limit(1);

    if (existing) {
      return existing;
    }

    return this.createGame(game);
  }

  // Odds
  async getOddsForGame(gameId: number): Promise<Odds[]> {
    return db.select().from(odds)
      .where(eq(odds.gameId, gameId))
      .orderBy(desc(odds.capturedAt));
  }

  async getLatestOddsForGame(gameId: number): Promise<Odds | undefined> {
    const [latest] = await db.select().from(odds)
      .where(eq(odds.gameId, gameId))
      .orderBy(desc(odds.capturedAt))
      .limit(1);
    return latest;
  }

  async createOdds(oddsData: InsertOdds): Promise<Odds> {
    const [created] = await db.insert(odds).values(oddsData).returning();
    return created;
  }

  // Line Movements
  async getLineMovements(gameId: number): Promise<LineMovement[]> {
    return db.select().from(lineMovements)
      .where(eq(lineMovements.gameId, gameId))
      .orderBy(lineMovements.capturedAt);
  }

  async createLineMovement(movement: InsertLineMovement): Promise<LineMovement> {
    const [created] = await db.insert(lineMovements).values(movement).returning();
    return created;
  }

  // Betting Percentages
  async getBettingPercentages(gameId: number): Promise<BettingPercentage[]> {
    return db.select().from(bettingPercentages)
      .where(eq(bettingPercentages.gameId, gameId))
      .orderBy(desc(bettingPercentages.capturedAt));
  }

  async createBettingPercentage(pct: InsertBettingPercentage): Promise<BettingPercentage> {
    const [created] = await db.insert(bettingPercentages).values(pct).returning();
    return created;
  }

  // Team Stats
  async getTeamStats(filters?: { teamId?: number; teamName?: string; sport?: string; splitType?: string }): Promise<TeamStats[]> {
    let conditions = [];
    
    if (filters?.teamId) {
      conditions.push(eq(teamStats.teamId, filters.teamId));
    }
    if (filters?.teamName) {
      conditions.push(eq(teamStats.teamName, filters.teamName));
    }
    if (filters?.sport) {
      conditions.push(eq(teamStats.sport, filters.sport));
    }
    if (filters?.splitType) {
      conditions.push(eq(teamStats.splitType, filters.splitType));
    }

    if (conditions.length > 0) {
      return db.select().from(teamStats).where(and(...conditions));
    }
    return db.select().from(teamStats);
  }

  async createTeamStats(stats: InsertTeamStats): Promise<TeamStats> {
    const [created] = await db.insert(teamStats).values(stats).returning();
    return created;
  }

  async upsertTeamStats(stats: InsertTeamStats): Promise<TeamStats> {
    // Try to find existing stats
    const existing = await db.select().from(teamStats)
      .where(and(
        eq(teamStats.teamName, stats.teamName),
        eq(teamStats.sport, stats.sport),
        eq(teamStats.splitType, stats.splitType),
        eq(teamStats.source, stats.source)
      ))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(teamStats)
        .set({ ...stats, capturedAt: new Date() })
        .where(eq(teamStats.id, existing[0].id))
        .returning();
      return updated;
    }

    return this.createTeamStats(stats);
  }

  // Projections
  async getProjectionForGame(gameId: number): Promise<Projection | undefined> {
    const [projection] = await db.select().from(projections)
      .where(eq(projections.gameId, gameId))
      .orderBy(desc(projections.createdAt))
      .limit(1);
    return projection;
  }

  async getProjections(gameIds?: number[]): Promise<Projection[]> {
    if (gameIds && gameIds.length > 0) {
      return db.select().from(projections)
        .where(inArray(projections.gameId, gameIds));
    }
    return db.select().from(projections);
  }

  async createProjection(projection: InsertProjection): Promise<Projection> {
    const [created] = await db.insert(projections).values(projection).returning();
    return created;
  }

  // Opportunities
  async getOpportunities(filters?: { sports?: string[]; confidence?: string; status?: string }): Promise<Opportunity[]> {
    let conditions = [];

    if (filters?.sports && filters.sports.length > 0) {
      conditions.push(inArray(opportunities.sport, filters.sports));
    }
    if (filters?.confidence) {
      conditions.push(eq(opportunities.confidence, filters.confidence));
    }
    if (filters?.status) {
      conditions.push(eq(opportunities.status, filters.status));
    } else {
      conditions.push(eq(opportunities.status, "active"));
    }

    if (conditions.length > 0) {
      return db.select().from(opportunities)
        .where(and(...conditions))
        .orderBy(desc(opportunities.edgePercentage));
    }
    return db.select().from(opportunities).orderBy(desc(opportunities.edgePercentage));
  }

  async getOpportunityById(id: number): Promise<Opportunity | undefined> {
    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, id));
    return opp;
  }

  async createOpportunity(opp: InsertOpportunity): Promise<Opportunity> {
    const [created] = await db.insert(opportunities).values(opp).returning();
    return created;
  }

  async updateOpportunity(id: number, opp: Partial<InsertOpportunity>): Promise<Opportunity | undefined> {
    const [updated] = await db.update(opportunities)
      .set({ ...opp, updatedAt: new Date() })
      .where(eq(opportunities.id, id))
      .returning();
    return updated;
  }

  // RLM Signals
  async getRlmSignals(filters?: { sports?: string[]; date?: Date }): Promise<RlmSignal[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const signalsWithGames = await db.select({
      signal: rlmSignals,
      game: games
    })
    .from(rlmSignals)
    .leftJoin(games, eq(rlmSignals.gameId, games.id))
    .where(gte(rlmSignals.detectedAt, today))
    .orderBy(desc(rlmSignals.detectedAt));

    // Filter by sports if provided
    let result = signalsWithGames;
    if (filters?.sports && filters.sports.length > 0) {
      result = signalsWithGames.filter(r => r.game && filters.sports!.includes(r.game.sport));
    }

    return result.map(r => ({
      ...r.signal,
      game: r.game
    })) as any;
  }

  async createRlmSignal(signal: InsertRlmSignal): Promise<RlmSignal> {
    const [created] = await db.insert(rlmSignals).values(signal).returning();
    return created;
  }

  // Backtest Results
  async getBacktestResults(): Promise<BacktestResult[]> {
    return db.select().from(backtestResults).orderBy(desc(backtestResults.createdAt));
  }

  async createBacktestResult(result: InsertBacktestResult): Promise<BacktestResult> {
    const [created] = await db.insert(backtestResults).values(result).returning();
    return created;
  }

  // Data Sources
  async getDataSources(): Promise<DataSource[]> {
    return db.select().from(dataSources);
  }

  async getDataSourceByName(name: string): Promise<DataSource | undefined> {
    const [source] = await db.select().from(dataSources).where(eq(dataSources.name, name));
    return source;
  }

  async createDataSource(source: InsertDataSource): Promise<DataSource> {
    const [created] = await db.insert(dataSources).values(source).returning();
    return created;
  }

  async updateDataSource(name: string, source: Partial<InsertDataSource>): Promise<DataSource | undefined> {
    const [updated] = await db.update(dataSources)
      .set(source)
      .where(eq(dataSources.name, name))
      .returning();
    return updated;
  }

  // Pattern Discoveries
  async getPatternDiscoveries(filters?: { sports?: string[]; active?: boolean }): Promise<PatternDiscovery[]> {
    let conditions = [];

    if (filters?.sports && filters.sports.length > 0) {
      conditions.push(inArray(patternDiscoveries.sport, filters.sports));
    }
    if (filters?.active !== undefined) {
      conditions.push(eq(patternDiscoveries.isActive, filters.active));
    }

    if (conditions.length > 0) {
      return db.select().from(patternDiscoveries)
        .where(and(...conditions))
        .orderBy(desc(patternDiscoveries.discoveredAt));
    }
    return db.select().from(patternDiscoveries).orderBy(desc(patternDiscoveries.discoveredAt));
  }

  async createPatternDiscovery(pattern: InsertPatternDiscovery): Promise<PatternDiscovery> {
    const [created] = await db.insert(patternDiscoveries).values(pattern).returning();
    return created;
  }

  // Dashboard Stats
  async getDashboardStats(sports?: string[]): Promise<{
    totalOpportunities: number;
    highConfidenceCount: number;
    rlmSignalsToday: number;
    gamesWithEdge: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      // Get all active opportunities with optional sport filter
      let allOpps;
      if (sports && sports.length > 0) {
        allOpps = await db.select().from(opportunities)
          .where(and(
            eq(opportunities.status, "active"),
            inArray(opportunities.sport, sports)
          ));
      } else {
        allOpps = await db.select().from(opportunities)
          .where(eq(opportunities.status, "active"));
      }
      
      // Count totals
      const totalOpportunities = allOpps.length;
      const highConfidenceCount = allOpps.filter(o => o.confidence === "High").length;
      const gamesWithEdge = new Set(allOpps.map(o => o.gameId)).size;

      // Count RLM signals today
      const rlmToday = await db.select().from(rlmSignals)
        .where(gte(rlmSignals.detectedAt, today));
      const rlmSignalsToday = rlmToday.length;

      return {
        totalOpportunities,
        highConfidenceCount,
        rlmSignalsToday,
        gamesWithEdge,
      };
    } catch (error) {
      console.error("getDashboardStats error:", error);
      return {
        totalOpportunities: 0,
        highConfidenceCount: 0,
        rlmSignalsToday: 0,
        gamesWithEdge: 0,
      };
    }
  }
}

export const storage = new DatabaseStorage();
