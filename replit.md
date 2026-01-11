# Jobu Sports Betting Analytics Platform

## Overview

A sports betting analytics platform that processes team statistics, generates algorithmic projections, and identifies betting opportunities across NFL, NBA, CFB, and CBB. The system uses proprietary "Jobu Algorithm" variants for each sport to calculate fair lines, detect reverse line movement (RLM) signals, and surface high-confidence betting edges.

The platform supports Excel/CSV data uploads for team statistics, runs backtesting against historical signals, and includes AI-powered pattern discovery using OpenAI integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode)
- **Build Tool**: Vite with path aliases (@/, @shared/, @assets/)

The frontend follows a page-based structure with shared components. Key pages include Dashboard, Opportunities, RLM Signals, Backtesting, Data Sources, Patterns, and Settings.

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Style**: REST endpoints under /api prefix
- **File Uploads**: Multer for Excel/CSV processing

The server uses a layered architecture:
- `routes.ts` - API endpoint definitions
- `storage.ts` - Database abstraction layer with interface-based design
- `services/` - Business logic (jobu-algorithm, rlm-detector, excel-parser, ai-pattern-discovery)

### Algorithm System
Four sport-specific algorithm versions process team statistics:
- NFL v4.0R1, NBA v3.5R1, CFB v3.5R1, CBB v3.6R1

Each algorithm applies blend conditioning (55% home/away splits, 35% season baseline, 10% recent usage) with sport-specific adjustments for efficiency, pace, and situational factors.

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client/server)
- **Migrations**: Drizzle Kit with `db:push` command

Core entities: users, teams, games, odds, lineMovements, bettingPercentages, teamStats, projections, opportunities, rlmSignals, backtestResults, dataSources, patternDiscoveries, conversations, messages.

### Build System
- Development: `tsx` for TypeScript execution with Vite dev server
- Production: Custom build script using esbuild for server, Vite for client
- Output: `dist/` directory with `index.cjs` (server) and `public/` (client assets)

## External Dependencies

### Database
- PostgreSQL via `DATABASE_URL` environment variable
- Connection pooling with `pg` package
- Session storage with `connect-pg-simple`

### AI Integration
- OpenAI API for pattern discovery and chat features
- Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
- Model: gpt-4o for analysis, gpt-image-1 for image generation

### Data Processing
- `xlsx` package for Excel file parsing
- Custom parser maps various column naming conventions to normalized schema

### Replit Integrations
Pre-built integration modules in `server/replit_integrations/`:
- `batch/` - Rate-limited batch processing with retries
- `chat/` - Conversation and message storage with OpenAI streaming
- `image/` - Image generation endpoints

### External Data Sources (Configured)
The platform references these data sources for market data (configured via API keys in settings):
- TeamRankings, Covers, VegasInsider for odds/lines
- Rotowire for injury/rotation data