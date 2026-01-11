import OpenAI from "openai";
import { storage } from "../storage";
import type { InsertPatternDiscovery } from "@shared/schema";

// Lazy initialization of OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!openaiClient && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

interface AnalysisContext {
  sport: string;
  opportunities: any[];
  rlmSignals: any[];
  recentResults: any[];
}

// Analyze patterns in betting data using AI
export async function discoverPatterns(context: AnalysisContext): Promise<InsertPatternDiscovery[]> {
  const patterns: InsertPatternDiscovery[] = [];
  
  if (!context.opportunities.length && !context.rlmSignals.length) {
    return patterns;
  }
  
  const openai = getOpenAI();
  if (!openai) {
    console.warn("OpenAI not configured - AI pattern discovery disabled");
    return patterns;
  }
  
  try {
    // Prepare data summary for AI analysis
    const dataSummary = prepareDataSummary(context);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a sports betting analytics expert. Analyze the provided betting data and identify meaningful patterns that could inform betting strategy.

Focus on:
1. RLM (Reverse Line Movement) correlation patterns
2. Handle split patterns (ticket % vs money % divergence)
3. Efficiency trends (teams over/underperforming metrics)
4. Venue-specific advantages
5. Pace/tempo matchup patterns

For each pattern you identify, provide:
- Pattern type (rlm_correlation, handle_pattern, efficiency_trend, venue_advantage, pace_matchup)
- Description of the pattern
- Confidence level (0.0 to 1.0)
- Actionable recommendation

Respond in JSON format with an array of patterns.`
        },
        {
          role: "user",
          content: `Analyze this ${context.sport} betting data and identify patterns:

${dataSummary}

Respond with a JSON array of patterns found.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    
    const result = response.choices[0]?.message?.content;
    if (!result) return patterns;
    
    const parsed = JSON.parse(result);
    const discoveredPatterns = parsed.patterns || parsed.discoveries || [];
    
    for (const p of discoveredPatterns) {
      if (p.description && p.confidence) {
        patterns.push({
          sport: context.sport || null,
          patternType: p.patternType || p.type || "unknown",
          description: p.description,
          confidence: Math.min(1, Math.max(0, parseFloat(p.confidence) || 0.5)),
          supportingData: p.supportingData || null,
          recommendation: p.recommendation || null,
          isActive: true,
        });
      }
    }
  } catch (error) {
    console.error("AI pattern discovery error:", error);
  }
  
  return patterns;
}

function prepareDataSummary(context: AnalysisContext): string {
  const lines: string[] = [];
  
  lines.push(`Sport: ${context.sport}`);
  lines.push(`\nOpportunities Summary (${context.opportunities.length} total):`);
  
  // Summarize opportunities by type
  const byMarket = context.opportunities.reduce((acc: any, o: any) => {
    acc[o.marketType] = (acc[o.marketType] || 0) + 1;
    return acc;
  }, {});
  
  for (const [market, count] of Object.entries(byMarket)) {
    lines.push(`- ${market}: ${count}`);
  }
  
  // Summarize confidence levels
  const byConf = context.opportunities.reduce((acc: any, o: any) => {
    acc[o.confidence] = (acc[o.confidence] || 0) + 1;
    return acc;
  }, {});
  
  lines.push(`\nBy Confidence:`);
  for (const [conf, count] of Object.entries(byConf)) {
    lines.push(`- ${conf}: ${count}`);
  }
  
  // RLM signals
  lines.push(`\nRLM Signals (${context.rlmSignals.length} total):`);
  const rlmByStrength = context.rlmSignals.reduce((acc: any, s: any) => {
    acc[s.signalStrength] = (acc[s.signalStrength] || 0) + 1;
    return acc;
  }, {});
  
  for (const [strength, count] of Object.entries(rlmByStrength)) {
    lines.push(`- ${strength}: ${count}`);
  }
  
  // Sample recent opportunities with details
  if (context.opportunities.length > 0) {
    lines.push(`\nSample Opportunities:`);
    for (const o of context.opportunities.slice(0, 5)) {
      lines.push(`- ${o.playDescription}: Edge ${o.edgePercentage}%, V=${o.volatilityScore}, ${o.confidence}`);
    }
  }
  
  // Sample RLM signals
  if (context.rlmSignals.length > 0) {
    lines.push(`\nSample RLM Signals:`);
    for (const s of context.rlmSignals.slice(0, 5)) {
      lines.push(`- ${s.marketType}: Tickets ${s.ticketPercentage}% vs Money ${s.moneyPercentage}%, Move ${s.lineMovementSize > 0 ? "+" : ""}${s.lineMovementSize}`);
    }
  }
  
  return lines.join("\n");
}

// Analyze a specific game for betting patterns
export async function analyzeGamePatterns(gameId: number): Promise<string[]> {
  const insights: string[] = [];
  
  const openai = getOpenAI();
  if (!openai) {
    return ["AI analysis not available - OpenAI not configured"];
  }
  
  try {
    const game = await storage.getGameById(gameId);
    if (!game) return insights;
    
    const bettingPcts = await storage.getBettingPercentages(gameId);
    const lineMovements = await storage.getLineMovements(gameId);
    const projection = await storage.getProjectionForGame(gameId);
    
    // Prepare context for AI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a sports betting analyst. Provide 2-3 brief, actionable insights about this game based on the data provided. Be specific and direct.`
        },
        {
          role: "user",
          content: `Game: ${game.awayTeamName} @ ${game.homeTeamName} (${game.sport})

Betting Data:
${bettingPcts.map(p => `- ${p.marketType} ${p.side}: ${p.ticketPercentage}% tickets, ${p.moneyPercentage}% money`).join("\n")}

Line Movements:
${lineMovements.map(m => `- ${m.marketType}: ${m.previousValue} → ${m.currentValue}`).join("\n")}

${projection ? `Projection: Fair spread ${projection.fairSpread}, Fair total ${projection.fairTotal}, Volatility ${projection.volatilityScore}` : "No projection available"}

Provide 2-3 actionable insights.`
        }
      ],
      temperature: 0.4,
      max_tokens: 300,
    });
    
    const content = response.choices[0]?.message?.content || "";
    
    // Parse insights from response
    const lines = content.split("\n").filter(l => l.trim().length > 0);
    for (const line of lines) {
      const cleanLine = line.replace(/^[\d\.\-\*]\s*/, "").trim();
      if (cleanLine.length > 10) {
        insights.push(cleanLine);
      }
    }
  } catch (error) {
    console.error("Game pattern analysis error:", error);
  }
  
  return insights.slice(0, 3);
}

// Run pattern discovery for all sports
export async function runPatternDiscovery(): Promise<number> {
  const sports = ["NFL", "NBA", "CFB", "CBB"];
  let patternCount = 0;
  
  for (const sport of sports) {
    try {
      const opportunities = await storage.getOpportunities({ sports: [sport] });
      const rlmSignals = await storage.getRlmSignals({ sports: [sport] });
      
      if (opportunities.length === 0 && rlmSignals.length === 0) continue;
      
      const patterns = await discoverPatterns({
        sport,
        opportunities,
        rlmSignals,
        recentResults: [], // Could add historical results here
      });
      
      for (const pattern of patterns) {
        await storage.createPatternDiscovery(pattern);
        patternCount++;
      }
    } catch (error) {
      console.error(`Pattern discovery error for ${sport}:`, error);
    }
  }
  
  return patternCount;
}
