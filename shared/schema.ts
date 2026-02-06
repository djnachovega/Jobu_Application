import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export chat models
export * from "./models/chat";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Sports enum type
export const sportTypes = ["NFL", "NBA", "CFB", "CBB"] as const;
export type SportType = typeof sportTypes[number];

// Teams table
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  sport: text("sport").notNull(), // NFL, NBA, CFB, CBB
  conference: text("conference"),
  division: text("division"),
  externalId: text("external_id"), // ESPN/league ID
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

// Team aliases table - maps various name formats to canonical team
export const teamAliases = pgTable("team_aliases", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  alias: text("alias").notNull(),
  sport: text("sport").notNull(),
  source: text("source"), // excel, espn, nba, nfl, etc
});

export const insertTeamAliasSchema = createInsertSchema(teamAliases).omit({ id: true });
export type InsertTeamAlias = z.infer<typeof insertTeamAliasSchema>;
export type TeamAlias = typeof teamAliases.$inferSelect;

// Games table
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  externalId: text("external_id"),
  sport: text("sport").notNull(),
  awayTeamId: integer("away_team_id").references(() => teams.id),
  homeTeamId: integer("home_team_id").references(() => teams.id),
  awayTeamName: text("away_team_name").notNull(),
  homeTeamName: text("home_team_name").notNull(),
  gameDate: timestamp("game_date").notNull(),
  status: text("status").default("scheduled"), // scheduled, live, final
  awayScore: integer("away_score"),
  homeScore: integer("home_score"),
  venue: text("venue"),
  isNeutralSite: boolean("is_neutral_site").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertGameSchema = createInsertSchema(games).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;

// Odds/Lines table - stores current and historical odds
export const odds = pgTable("odds", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => games.id).notNull(),
  sportsbook: text("sportsbook").notNull(), // DraftKings, FanDuel, BetMGM, etc.
  spreadHome: real("spread_home"),
  spreadAway: real("spread_away"),
  spreadHomeOdds: integer("spread_home_odds"),
  spreadAwayOdds: integer("spread_away_odds"),
  moneylineHome: integer("moneyline_home"),
  moneylineAway: integer("moneyline_away"),
  totalOver: real("total_over"),
  totalUnder: real("total_under"),
  totalOverOdds: integer("total_over_odds"),
  totalUnderOdds: integer("total_under_odds"),
  isOpening: boolean("is_opening").default(false),
  capturedAt: timestamp("captured_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertOddsSchema = createInsertSchema(odds).omit({ id: true, capturedAt: true });
export type InsertOdds = z.infer<typeof insertOddsSchema>;
export type Odds = typeof odds.$inferSelect;

// Line movements table
export const lineMovements = pgTable("line_movements", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => games.id).notNull(),
  marketType: text("market_type").notNull(), // spread, total, moneyline
  previousValue: real("previous_value").notNull(),
  currentValue: real("current_value").notNull(),
  movementDirection: text("movement_direction").notNull(), // up, down
  movementSize: real("movement_size").notNull(),
  capturedAt: timestamp("captured_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertLineMovementSchema = createInsertSchema(lineMovements).omit({ id: true, capturedAt: true });
export type InsertLineMovement = z.infer<typeof insertLineMovementSchema>;
export type LineMovement = typeof lineMovements.$inferSelect;

// Betting percentages table - ticket % vs money %
export const bettingPercentages = pgTable("betting_percentages", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => games.id).notNull(),
  marketType: text("market_type").notNull(), // spread, total, moneyline
  side: text("side").notNull(), // home, away, over, under
  ticketPercentage: real("ticket_percentage").notNull(),
  moneyPercentage: real("money_percentage").notNull(),
  capturedAt: timestamp("captured_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertBettingPercentageSchema = createInsertSchema(bettingPercentages).omit({ id: true, capturedAt: true });
export type InsertBettingPercentage = z.infer<typeof insertBettingPercentageSchema>;
export type BettingPercentage = typeof bettingPercentages.$inferSelect;

// Team stats table - for TeamRankings and KenPom data
export const teamStats = pgTable("team_stats", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id),
  teamName: text("team_name").notNull(),
  sport: text("sport").notNull(),
  splitType: text("split_type").notNull(), // home, away, season, last3, last5, last10
  // Efficiency metrics
  offensivePPP: real("offensive_ppp"),
  defensivePPP: real("defensive_ppp"),
  offensiveRating: real("offensive_rating"),
  defensiveRating: real("defensive_rating"),
  // Pace metrics
  pace: real("pace"),
  possessionsPerGame: real("possessions_per_game"),
  opponentPossessionsPerGame: real("opponent_possessions_per_game"),
  playsPerGame: real("plays_per_game"),
  // Four factors
  effectiveFieldGoalPct: real("effective_field_goal_pct"),
  turnoverPct: real("turnover_pct"),
  offensiveReboundPct: real("offensive_rebound_pct"),
  freeThrowRate: real("free_throw_rate"),
  // Additional shooting
  threePointPct: real("three_point_pct"),
  threePointRate: real("three_point_rate"),
  freeThrowPct: real("free_throw_pct"),
  rimFinishingPct: real("rim_finishing_pct"),
  // Football specific
  yardsPerPlay: real("yards_per_play"),
  opponentYardsPerPlay: real("opponent_yards_per_play"),
  redZoneScoringPct: real("red_zone_scoring_pct"),
  thirdDownConversionPct: real("third_down_conversion_pct"),
  penaltiesPerGame: real("penalties_per_game"),
  // KenPom specific (CBB)
  kenpomRank: integer("kenpom_rank"),
  kenpomAdjustedEfficiency: real("kenpom_adjusted_efficiency"),
  kenpomTempo: real("kenpom_tempo"),
  kenpomLuck: real("kenpom_luck"),
  // Strength of schedule
  strengthOfSchedule: real("strength_of_schedule"),
  // Raw JSON for additional data
  rawData: jsonb("raw_data"),
  source: text("source").notNull(), // teamrankings, kenpom, excel
  capturedAt: timestamp("captured_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTeamStatsSchema = createInsertSchema(teamStats).omit({ id: true, capturedAt: true });
export type InsertTeamStats = z.infer<typeof insertTeamStatsSchema>;
export type TeamStats = typeof teamStats.$inferSelect;

// Projections table - model outputs per game
export const projections = pgTable("projections", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => games.id).notNull(),
  algorithmVersion: text("algorithm_version").notNull(), // e.g., "NFL v4.0R1"
  // Projected scores
  projectedAwayScore: real("projected_away_score").notNull(),
  projectedHomeScore: real("projected_home_score").notNull(),
  projectedTotal: real("projected_total").notNull(),
  projectedMargin: real("projected_margin").notNull(),
  // Fair lines
  fairSpread: real("fair_spread").notNull(),
  fairTotal: real("fair_total").notNull(),
  fairMoneylineHome: integer("fair_moneyline_home"),
  fairMoneylineAway: integer("fair_moneyline_away"),
  // Expected possessions/pace
  expectedPossessions: real("expected_possessions"),
  // Volatility score (0-100)
  volatilityScore: integer("volatility_score").notNull(),
  // Blend breakdown
  blendHomeAway: real("blend_home_away"), // e.g., 55%
  blendSeason: real("blend_season"), // e.g., 35%
  blendRecent: real("blend_recent"), // e.g., 10%
  // SoS adjustment
  sosAdjustment: real("sos_adjustment"),
  // Detailed metrics JSON
  detailedMetrics: jsonb("detailed_metrics"),
  // Drivers/reasons
  drivers: jsonb("drivers"), // Array of driver strings
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertProjectionSchema = createInsertSchema(projections).omit({ id: true, createdAt: true });
export type InsertProjection = z.infer<typeof insertProjectionSchema>;
export type Projection = typeof projections.$inferSelect;

// Opportunities table - identified betting opportunities
export const opportunities = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => games.id).notNull(),
  projectionId: integer("projection_id").references(() => projections.id),
  sport: text("sport").notNull(),
  marketType: text("market_type").notNull(), // spread, total, moneyline, team_total, 1h
  side: text("side").notNull(), // home, away, over, under
  playDescription: text("play_description").notNull(), // e.g., "Over 226.5 — to −115"
  currentLine: real("current_line"),
  currentOdds: integer("current_odds"),
  fairLine: real("fair_line"),
  edgePercentage: real("edge_percentage").notNull(),
  confidence: text("confidence").notNull(), // High, Medium, Lean
  volatilityScore: integer("volatility_score").notNull(),
  // RLM indicators
  isReverseLineMovement: boolean("is_reverse_line_movement").default(false),
  ticketPercentage: real("ticket_percentage"),
  moneyPercentage: real("money_percentage"),
  // Drivers
  drivers: jsonb("drivers"),
  killSwitches: jsonb("kill_switches"),
  // Status
  status: text("status").default("active"), // active, expired, won, lost, push
  result: text("result"), // W, L, P
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertOpportunitySchema = createInsertSchema(opportunities).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunities.$inferSelect;

// RLM signals table - reverse line movement detection
export const rlmSignals = pgTable("rlm_signals", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => games.id).notNull(),
  marketType: text("market_type").notNull(),
  side: text("side").notNull(),
  ticketPercentage: real("ticket_percentage").notNull(),
  moneyPercentage: real("money_percentage").notNull(),
  lineMovementDirection: text("line_movement_direction").notNull(),
  lineMovementSize: real("line_movement_size").notNull(),
  signalStrength: text("signal_strength").notNull(), // strong, moderate, weak
  detectedAt: timestamp("detected_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertRlmSignalSchema = createInsertSchema(rlmSignals).omit({ id: true, detectedAt: true });
export type InsertRlmSignal = z.infer<typeof insertRlmSignalSchema>;
export type RlmSignal = typeof rlmSignals.$inferSelect;

// Backtesting results table
export const backtestResults = pgTable("backtest_results", {
  id: serial("id").primaryKey(),
  sport: text("sport").notNull(),
  signalType: text("signal_type").notNull(), // rlm, handle_split, model_edge
  dateRangeStart: timestamp("date_range_start").notNull(),
  dateRangeEnd: timestamp("date_range_end").notNull(),
  totalSignals: integer("total_signals").notNull(),
  wins: integer("wins").notNull(),
  losses: integer("losses").notNull(),
  pushes: integer("pushes").notNull(),
  winPercentage: real("win_percentage").notNull(),
  roi: real("roi"),
  averageEdge: real("average_edge"),
  // Breakdown by confidence
  highConfidenceRecord: jsonb("high_confidence_record"),
  mediumConfidenceRecord: jsonb("medium_confidence_record"),
  leanConfidenceRecord: jsonb("lean_confidence_record"),
  // Parameters used
  parameters: jsonb("parameters"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertBacktestResultSchema = createInsertSchema(backtestResults).omit({ id: true, createdAt: true });
export type InsertBacktestResult = z.infer<typeof insertBacktestResultSchema>;
export type BacktestResult = typeof backtestResults.$inferSelect;

// Data sources configuration
export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // actionnetwork, teamrankings, kenpom
  displayName: text("display_name").notNull(),
  isActive: boolean("is_active").default(true),
  requiresAuth: boolean("requires_auth").default(false),
  lastRefreshAt: timestamp("last_refresh_at"),
  lastRefreshStatus: text("last_refresh_status"), // success, error
  lastRefreshError: text("last_refresh_error"),
  refreshIntervalMinutes: integer("refresh_interval_minutes").default(15),
  configJson: jsonb("config_json"), // URLs, selectors, etc.
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDataSourceSchema = createInsertSchema(dataSources).omit({ id: true, createdAt: true });
export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DataSource = typeof dataSources.$inferSelect;

// AI pattern discoveries
export const patternDiscoveries = pgTable("pattern_discoveries", {
  id: serial("id").primaryKey(),
  sport: text("sport"),
  patternType: text("pattern_type").notNull(), // rlm_correlation, handle_pattern, efficiency_trend
  description: text("description").notNull(),
  confidence: real("confidence").notNull(),
  supportingData: jsonb("supporting_data"),
  recommendation: text("recommendation"),
  isActive: boolean("is_active").default(true),
  discoveredAt: timestamp("discovered_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertPatternDiscoverySchema = createInsertSchema(patternDiscoveries).omit({ id: true, discoveredAt: true });
export type InsertPatternDiscovery = z.infer<typeof insertPatternDiscoverySchema>;
export type PatternDiscovery = typeof patternDiscoveries.$inferSelect;

// User settings table - persisted app preferences
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSettingSchema = createInsertSchema(userSettings).omit({ id: true, updatedAt: true });
export type InsertUserSetting = z.infer<typeof insertUserSettingSchema>;
export type UserSetting = typeof userSettings.$inferSelect;

// Relations
export const gamesRelations = relations(games, ({ one, many }) => ({
  awayTeam: one(teams, { fields: [games.awayTeamId], references: [teams.id] }),
  homeTeam: one(teams, { fields: [games.homeTeamId], references: [teams.id] }),
  odds: many(odds),
  lineMovements: many(lineMovements),
  bettingPercentages: many(bettingPercentages),
  projections: many(projections),
  opportunities: many(opportunities),
  rlmSignals: many(rlmSignals),
}));

export const oddsRelations = relations(odds, ({ one }) => ({
  game: one(games, { fields: [odds.gameId], references: [games.id] }),
}));

export const lineMovementsRelations = relations(lineMovements, ({ one }) => ({
  game: one(games, { fields: [lineMovements.gameId], references: [games.id] }),
}));

export const bettingPercentagesRelations = relations(bettingPercentages, ({ one }) => ({
  game: one(games, { fields: [bettingPercentages.gameId], references: [games.id] }),
}));

export const projectionsRelations = relations(projections, ({ one }) => ({
  game: one(games, { fields: [projections.gameId], references: [games.id] }),
}));

export const opportunitiesRelations = relations(opportunities, ({ one }) => ({
  game: one(games, { fields: [opportunities.gameId], references: [games.id] }),
  projection: one(projections, { fields: [opportunities.projectionId], references: [projections.id] }),
}));

export const rlmSignalsRelations = relations(rlmSignals, ({ one }) => ({
  game: one(games, { fields: [rlmSignals.gameId], references: [games.id] }),
}));

export const teamStatsRelations = relations(teamStats, ({ one }) => ({
  team: one(teams, { fields: [teamStats.teamId], references: [teams.id] }),
}));
