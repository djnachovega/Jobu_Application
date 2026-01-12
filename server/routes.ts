import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { parseExcelFile } from "./services/excel-parser";
import { generateProjection, createProjectionRecord, identifyOpportunities, ALGORITHM_VERSIONS } from "./services/jobu-algorithm";
import { analyzeGameForRlm, analyzeHandleSplit } from "./services/rlm-detector";
import { discoverPatterns, analyzeGamePatterns, runPatternDiscovery } from "./services/ai-pattern-discovery";
import { runScraper, type ScraperName } from "./services/scrapers";
import { runFullPipeline, importExcelAndProcess } from "./services/pipeline";
import { seedCommonAliases } from "./services/team-resolver";
import * as fs from "fs";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Dashboard stats
  app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
    try {
      // Parse sports from query - can be comma-separated string or array
      let sports: string[] | undefined;
      if (req.query.sports) {
        const sportsParam = req.query.sports;
        if (typeof sportsParam === "string") {
          sports = sportsParam.split(",").filter(s => s.length > 0);
        } else if (Array.isArray(sportsParam)) {
          sports = sportsParam.map(String).filter(s => s.length > 0);
        }
      }
      const stats = await storage.getDashboardStats(sports && sports.length > 0 ? sports : undefined);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Games
  app.get("/api/games", async (req: Request, res: Response) => {
    try {
      const sports = req.query.sports ? (req.query.sports as string).split(",") : undefined;
      const games = await storage.getGames({ sports });
      res.json(games);
    } catch (error) {
      console.error("Error fetching games:", error);
      res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  app.get("/api/games/today", async (req: Request, res: Response) => {
    try {
      const sports = req.query.sports ? (req.query.sports as string).split(",") : undefined;
      const games = await storage.getGamesToday(sports);
      
      // Get latest odds for each game
      const gamesWithOdds = await Promise.all(games.map(async (game) => {
        const latestOdds = await storage.getLatestOddsForGame(game.id);
        const opps = await storage.getOpportunities({ sports: [game.sport] });
        const gameOpps = opps.filter(o => o.gameId === game.id);
        return {
          ...game,
          latestOdds,
          opportunityCount: gameOpps.length
        };
      }));
      
      res.json(gamesWithOdds);
    } catch (error) {
      console.error("Error fetching today's games:", error);
      res.status(500).json({ error: "Failed to fetch today's games" });
    }
  });

  app.get("/api/games/:id", async (req: Request, res: Response) => {
    try {
      const game = await storage.getGameById(parseInt(req.params.id));
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }
      
      const odds = await storage.getOddsForGame(game.id);
      const lineMovements = await storage.getLineMovements(game.id);
      const bettingPercentages = await storage.getBettingPercentages(game.id);
      const projection = await storage.getProjectionForGame(game.id);
      
      res.json({
        ...game,
        odds,
        lineMovements,
        bettingPercentages,
        projection
      });
    } catch (error) {
      console.error("Error fetching game:", error);
      res.status(500).json({ error: "Failed to fetch game" });
    }
  });

  // Opportunities
  app.get("/api/opportunities", async (req: Request, res: Response) => {
    try {
      const gameId = req.query.gameId ? parseInt(req.query.gameId as string) : undefined;
      const sports = req.query.sports ? (req.query.sports as string).split(",") : undefined;
      const confidence = req.query.confidence as string | undefined;
      let opportunities = await storage.getOpportunities({ sports, confidence });
      
      // Filter by gameId if provided
      if (gameId) {
        opportunities = opportunities.filter(o => o.gameId === gameId);
      }
      
      // Attach game data to each opportunity
      const oppsWithGames = await Promise.all(opportunities.map(async (opp) => {
        const game = await storage.getGameById(opp.gameId);
        return {
          ...opp,
          game: game ? {
            id: game.id,
            sport: game.sport,
            awayTeamName: game.awayTeamName,
            homeTeamName: game.homeTeamName,
            gameDate: game.gameDate,
            venue: game.venue,
            status: game.status
          } : null
        };
      }));
      
      res.json(oppsWithGames);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      res.status(500).json({ error: "Failed to fetch opportunities" });
    }
  });

  app.get("/api/opportunities/:id", async (req: Request, res: Response) => {
    try {
      const opportunity = await storage.getOpportunityById(parseInt(req.params.id));
      if (!opportunity) {
        return res.status(404).json({ error: "Opportunity not found" });
      }
      res.json(opportunity);
    } catch (error) {
      console.error("Error fetching opportunity:", error);
      res.status(500).json({ error: "Failed to fetch opportunity" });
    }
  });

  // RLM Signals
  app.get("/api/rlm-signals", async (req: Request, res: Response) => {
    try {
      const sports = req.query.sports ? (req.query.sports as string).split(",") : undefined;
      const signals = await storage.getRlmSignals({ sports });
      res.json(signals);
    } catch (error) {
      console.error("Error fetching RLM signals:", error);
      res.status(500).json({ error: "Failed to fetch RLM signals" });
    }
  });

  // Backtest
  app.get("/api/backtest/results", async (req: Request, res: Response) => {
    try {
      const results = await storage.getBacktestResults();
      res.json(results);
    } catch (error) {
      console.error("Error fetching backtest results:", error);
      res.status(500).json({ error: "Failed to fetch backtest results" });
    }
  });

  app.post("/api/backtest/run", async (req: Request, res: Response) => {
    try {
      const { sport, signalType, dateFrom, dateTo } = req.body;
      
      // Placeholder backtest logic - will be implemented with actual algorithm
      const result = await storage.createBacktestResult({
        sport: sport || "ALL",
        signalType: signalType || "rlm",
        dateRangeStart: dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        dateRangeEnd: dateTo ? new Date(dateTo) : new Date(),
        totalSignals: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        winPercentage: 0,
        roi: null,
        averageEdge: null,
        highConfidenceRecord: null,
        mediumConfidenceRecord: null,
        leanConfidenceRecord: null,
        parameters: { sport, signalType, dateFrom, dateTo },
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error running backtest:", error);
      res.status(500).json({ error: "Failed to run backtest" });
    }
  });

  // Data Sources
  app.get("/api/data-sources", async (req: Request, res: Response) => {
    try {
      let sources = await storage.getDataSources();
      
      // Initialize default sources if none exist
      if (sources.length === 0) {
        const defaultSources = [
          { name: "teamrankings", displayName: "TeamRankings", requiresAuth: false, refreshIntervalMinutes: 60 },
          { name: "covers", displayName: "Covers.com Odds", requiresAuth: false, refreshIntervalMinutes: 15 },
        ];
        
        for (const source of defaultSources) {
          await storage.createDataSource(source);
        }
        sources = await storage.getDataSources();
      }
      
      res.json(sources);
    } catch (error) {
      console.error("Error fetching data sources:", error);
      res.status(500).json({ error: "Failed to fetch data sources" });
    }
  });

  app.post("/api/data-sources/:name/refresh", async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      
      // Update the data source status to indicate refresh started
      await storage.updateDataSource(name, {
        lastRefreshAt: new Date(),
        lastRefreshStatus: "pending",
      });
      
      // Send immediate response - scraping runs in background
      res.json({ message: "Refresh started" });
      
      // Run the scraper in background
      const validScrapers: ScraperName[] = ["teamrankings", "covers", "schedules", "nba", "nfl", "cfb", "cbb"];
      if (validScrapers.includes(name as ScraperName)) {
        try {
          const result = await runScraper(name as ScraperName);
          await storage.updateDataSource(name, {
            lastRefreshStatus: result.success ? "success" : "error",
            lastRefreshError: result.error || null,
          });
          console.log(`Scraper ${name} completed:`, result.message);
        } catch (err) {
          await storage.updateDataSource(name, {
            lastRefreshStatus: "error",
            lastRefreshError: err instanceof Error ? err.message : "Unknown error",
          });
        }
      } else {
        await storage.updateDataSource(name, {
          lastRefreshStatus: "error",
          lastRefreshError: `Unknown data source: ${name}`,
        });
      }
    } catch (error) {
      console.error("Error refreshing data source:", error);
      res.status(500).json({ error: "Failed to refresh data source" });
    }
  });

  // Full Pipeline - scrape schedules, generate projections, create opportunities
  app.post("/api/pipeline/run", async (req: Request, res: Response) => {
    try {
      const sports = req.body.sports || ["NFL", "NBA", "CFB", "CBB"];
      
      res.json({ message: "Pipeline started", sports });
      
      // Run pipeline in background
      runFullPipeline(sports).then(result => {
        console.log("Pipeline complete:", result);
      }).catch(err => {
        console.error("Pipeline error:", err);
      });
    } catch (error) {
      console.error("Error starting pipeline:", error);
      res.status(500).json({ error: "Failed to start pipeline" });
    }
  });

  // Seed team aliases
  app.post("/api/teams/seed-aliases", async (req: Request, res: Response) => {
    try {
      const count = await seedCommonAliases();
      res.json({ message: `Seeded ${count} team aliases` });
    } catch (error) {
      console.error("Error seeding aliases:", error);
      res.status(500).json({ error: "Failed to seed aliases" });
    }
  });

  // Import Excel files from attached_assets
  app.post("/api/import/excel-assets", async (req: Request, res: Response) => {
    try {
      const assetsDir = "./attached_assets";
      const files = fs.readdirSync(assetsDir).filter(f => f.endsWith(".xlsx"));
      
      const results = [];
      for (const file of files) {
        const buffer = fs.readFileSync(`${assetsDir}/${file}`);
        const result = await importExcelAndProcess(buffer, file);
        results.push({ file, ...result });
      }
      
      res.json({ 
        message: `Imported ${results.length} Excel files`,
        results 
      });
    } catch (error) {
      console.error("Error importing Excel assets:", error);
      res.status(500).json({ error: "Failed to import Excel assets" });
    }
  });

  // Patterns
  app.get("/api/patterns", async (req: Request, res: Response) => {
    try {
      const sports = req.query.sports ? (req.query.sports as string).split(",") : undefined;
      const patterns = await storage.getPatternDiscoveries({ sports, active: true });
      res.json(patterns);
    } catch (error) {
      console.error("Error fetching patterns:", error);
      res.status(500).json({ error: "Failed to fetch patterns" });
    }
  });

  // Team Stats
  app.get("/api/team-stats", async (req: Request, res: Response) => {
    try {
      const sport = req.query.sport as string | undefined;
      const splitType = req.query.splitType as string | undefined;
      const stats = await storage.getTeamStats({ sport, splitType });
      res.json(stats);
    } catch (error) {
      console.error("Error fetching team stats:", error);
      res.status(500).json({ error: "Failed to fetch team stats" });
    }
  });

  // File Upload
  app.post("/api/upload/excel", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const result = await parseExcelFile(req.file.buffer, req.file.originalname);
      
      // Store parsed stats
      for (const stats of result.stats) {
        await storage.upsertTeamStats(stats);
      }

      res.json({
        message: "File processed successfully",
        rowsProcessed: result.stats.length,
        sport: result.sport,
      });
    } catch (error) {
      console.error("Error processing Excel file:", error);
      res.status(500).json({ error: "Failed to process Excel file" });
    }
  });

  // Projections
  app.get("/api/projections/:gameId", async (req: Request, res: Response) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const projection = await storage.getProjectionForGame(gameId);
      if (!projection) {
        return res.status(404).json({ error: "Projection not found" });
      }
      res.json(projection);
    } catch (error) {
      console.error("Error fetching projection:", error);
      res.status(500).json({ error: "Failed to fetch projection" });
    }
  });

  app.post("/api/projections/generate/:gameId", async (req: Request, res: Response) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const game = await storage.getGameById(gameId);
      
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }
      
      // Get team stats for both teams
      const awayStats = await storage.getTeamStats({ 
        teamName: game.awayTeamName, 
        sport: game.sport 
      });
      const homeStats = await storage.getTeamStats({ 
        teamName: game.homeTeamName, 
        sport: game.sport 
      });
      
      // Organize stats by split type
      const awayTeamStats = {
        home: awayStats.find(s => s.splitType === "home"),
        away: awayStats.find(s => s.splitType === "away"),
        season: awayStats.find(s => s.splitType === "season"),
        recent: awayStats.find(s => s.splitType === "last5") || awayStats.find(s => s.splitType === "last3"),
      };
      
      const homeTeamStats = {
        home: homeStats.find(s => s.splitType === "home"),
        away: homeStats.find(s => s.splitType === "away"),
        season: homeStats.find(s => s.splitType === "season"),
        recent: homeStats.find(s => s.splitType === "last5") || homeStats.find(s => s.splitType === "last3"),
      };
      
      // Generate projection
      const projectionResult = generateProjection(game, awayTeamStats, homeTeamStats);
      const projectionRecord = createProjectionRecord(gameId, game.sport, projectionResult);
      
      // Save projection
      const saved = await storage.createProjection(projectionRecord);
      
      // Get latest odds for opportunity identification
      const latestOdds = await storage.getLatestOddsForGame(gameId);
      
      // Identify opportunities
      const opportunities = identifyOpportunities(
        gameId,
        game.sport,
        projectionResult,
        latestOdds?.spreadHome || null,
        latestOdds?.totalOver || null
      );
      
      // Save opportunities
      for (const opp of opportunities) {
        opp.projectionId = saved.id;
        await storage.createOpportunity(opp);
      }
      
      res.json({
        projection: saved,
        opportunities,
        algorithmVersion: ALGORITHM_VERSIONS[game.sport as keyof typeof ALGORITHM_VERSIONS],
      });
    } catch (error) {
      console.error("Error generating projection:", error);
      res.status(500).json({ error: "Failed to generate projection" });
    }
  });

  // RLM Analysis
  app.post("/api/rlm-signals/analyze/:gameId", async (req: Request, res: Response) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const signals = await analyzeGameForRlm(gameId);
      
      // Save signals
      const savedSignals = [];
      for (const signal of signals) {
        const saved = await storage.createRlmSignal(signal);
        savedSignals.push(saved);
      }
      
      res.json({
        signalsFound: savedSignals.length,
        signals: savedSignals,
      });
    } catch (error) {
      console.error("Error analyzing RLM:", error);
      res.status(500).json({ error: "Failed to analyze RLM" });
    }
  });

  app.post("/api/rlm-signals/analyze-handle", async (req: Request, res: Response) => {
    try {
      const { ticketPct, moneyPct } = req.body;
      
      if (typeof ticketPct !== "number" || typeof moneyPct !== "number") {
        return res.status(400).json({ error: "ticketPct and moneyPct are required numbers" });
      }
      
      const analysis = analyzeHandleSplit(ticketPct, moneyPct);
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing handle:", error);
      res.status(500).json({ error: "Failed to analyze handle" });
    }
  });

  // AI Pattern Discovery
  app.post("/api/patterns/discover", async (req: Request, res: Response) => {
    try {
      const { sport } = req.body;
      
      const opportunities = await storage.getOpportunities({ sports: sport ? [sport] : undefined });
      const rlmSignals = await storage.getRlmSignals({ sports: sport ? [sport] : undefined });
      
      const patterns = await discoverPatterns({
        sport: sport || "ALL",
        opportunities,
        rlmSignals,
        recentResults: [],
      });
      
      // Save discovered patterns
      const savedPatterns = [];
      for (const pattern of patterns) {
        const saved = await storage.createPatternDiscovery(pattern);
        savedPatterns.push(saved);
      }
      
      res.json({
        patternsDiscovered: savedPatterns.length,
        patterns: savedPatterns,
      });
    } catch (error) {
      console.error("Error discovering patterns:", error);
      res.status(500).json({ error: "Failed to discover patterns" });
    }
  });

  app.get("/api/patterns/game/:gameId", async (req: Request, res: Response) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const insights = await analyzeGamePatterns(gameId);
      res.json({ insights });
    } catch (error) {
      console.error("Error analyzing game patterns:", error);
      res.status(500).json({ error: "Failed to analyze game patterns" });
    }
  });

  // Algorithm info
  app.get("/api/algorithms", async (req: Request, res: Response) => {
    try {
      res.json({
        versions: ALGORITHM_VERSIONS,
        sports: ["NFL", "NBA", "CFB", "CBB"],
        description: "Jobu algorithms use efficiency blending with home/away, season, and recent splits",
      });
    } catch (error) {
      console.error("Error fetching algorithm info:", error);
      res.status(500).json({ error: "Failed to fetch algorithm info" });
    }
  });

  return httpServer;
}
