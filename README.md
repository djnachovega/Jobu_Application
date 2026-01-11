# Jobu Sports Betting Analytics Platform

A comprehensive sports betting analytics platform that processes team statistics, generates algorithmic projections, and identifies betting opportunities across NFL, NBA, CFB, and CBB.

## Features

- **Algorithmic Projections**: Proprietary Jobu algorithms for each sport calculate fair lines and projected scores
- **RLM Detection**: Identifies Reverse Line Movement signals where sharp money opposes public betting
- **Handle Analysis**: Tracks ticket percentage vs money percentage divergence
- **Excel Data Import**: Upload TeamRankings and custom statistical data
- **AI Pattern Discovery**: Uses machine learning to identify betting patterns and trends
- **Backtesting**: Validate signal performance against historical data
- **Dark/Light Theme**: Modern UI with theme toggle

## Screenshots

The platform includes:
- Dashboard with key metrics and opportunity cards
- Opportunities page with filtering and sorting
- RLM Signals tracker
- Backtesting results with performance charts
- Data Sources management
- AI Pattern Discovery insights

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-4 for pattern discovery
- **Build**: Vite

---

## Installation

### Option 1: Run on Replit (Recommended)

1. Fork this Replit project
2. Click "Run" - the app starts automatically
3. The database is already configured

### Option 2: Run Locally

#### Prerequisites

- Node.js 20 or higher
- PostgreSQL 15 or higher
- Git

#### macOS Installation

```bash
# Install Homebrew (if needed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js and PostgreSQL
brew install node@20 postgresql@15
brew services start postgresql@15
```

#### Windows Installation

1. Download and install [Node.js 20+](https://nodejs.org/)
2. Download and install [PostgreSQL 15+](https://www.postgresql.org/download/windows/)
3. Add PostgreSQL to your PATH

#### Linux Installation

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/jobu-betting-analytics.git
cd jobu-betting-analytics
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Database

```bash
# macOS/Linux
createdb jobu_betting

# Windows (in PostgreSQL command prompt)
CREATE DATABASE jobu_betting;
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Required
DATABASE_URL=postgresql://localhost:5432/jobu_betting
SESSION_SECRET=generate-a-random-32-character-string

# Optional - for AI features
OPENAI_API_KEY=sk-your-openai-api-key
```

Generate a random secret:
```bash
openssl rand -hex 32
```

### 5. Initialize Database Schema

```bash
npm run db:push
```

### 6. Start Development Server

```bash
npm run dev
```

### 7. Open the Application

Navigate to [http://localhost:5000](http://localhost:5000)

---

## Usage

### Uploading Data

1. Go to **Data Sources** page
2. Click **Upload Excel/CSV**
3. Select your TeamRankings or custom stats file
4. The system auto-detects sport and stat types

#### Supported Excel Formats

| Column Name | Maps To |
|------------|---------|
| Team, Name | Team Name |
| PPP, Off PPP | Offensive Points Per Possession |
| Def PPP, Opp PPP | Defensive Points Per Possession |
| ORtg, Off Rating | Offensive Rating |
| DRtg, Def Rating | Defensive Rating |
| Pace, Tempo | Pace |
| eFG%, EFG | Effective Field Goal % |
| YPP | Yards Per Play (Football) |
| KenPom Rank | KenPom Ranking (CBB) |

### Viewing Opportunities

1. Go to **Opportunities** page
2. Filter by sport using sidebar toggles
3. Cards show edge percentage, confidence level, and drivers
4. Click for detailed analysis

### RLM Signal Detection

The system flags Reverse Line Movement when:
- Public betting is 60%+ on one side
- Money percentage diverges 10%+ from ticket percentage
- Line moves against public sentiment

Signal strength: **Strong** > **Moderate** > **Weak**

### Running Backtests

1. Go to **Backtesting** page
2. Select sport and signal type
3. Choose date range
4. Click **Run Backtest**
5. View win rate, ROI, and breakdown by confidence

---

## Algorithm Versions

| Sport | Version | Key Features |
|-------|---------|--------------|
| NFL | v4.0R1 | PPP efficiency, pace adjustment, venue factors |
| NBA | v3.5R1 | Rating-based, 100-possession normalization |
| CFB | v3.5R1 | Similar to NFL with college-specific variance |
| CBB | v3.6R1 | KenPom integration, tempo matching |

### Blend Weights

All algorithms use efficiency blending:
- **55%** Home/Away splits
- **35%** Season baseline
- **10%** Recent performance (last 3-5 games)

---

## API Reference

### Dashboard
```
GET /api/dashboard/stats?sports=NFL,NBA
```

### Games
```
GET /api/games/today?sports=NFL
GET /api/games/:id
```

### Opportunities
```
GET /api/opportunities?sports=NFL&confidence=High
```

### RLM Signals
```
GET /api/rlm-signals?sports=NBA
POST /api/rlm-signals/analyze/:gameId
```

### Projections
```
GET /api/projections/:gameId
POST /api/projections/generate/:gameId
```

### Data Upload
```
POST /api/upload/excel
Content-Type: multipart/form-data
```

### AI Patterns
```
GET /api/patterns?sports=NFL
POST /api/patterns/discover
```

---

## Project Structure

```
jobu-betting-analytics/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities
├── server/                 # Express backend
│   ├── services/           # Business logic
│   │   ├── jobu-algorithm.ts
│   │   ├── rlm-detector.ts
│   │   ├── ai-pattern-discovery.ts
│   │   └── excel-parser.ts
│   ├── routes.ts           # API endpoints
│   └── storage.ts          # Database layer
├── shared/                 # Shared types
│   └── schema.ts           # Database schema
└── LOCAL_SETUP.md          # Detailed local setup guide
```

---

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
brew services list | grep postgresql  # macOS
sudo systemctl status postgresql      # Linux

# Restart if needed
brew services restart postgresql@15   # macOS
sudo systemctl restart postgresql     # Linux
```

### Port 5000 Already in Use

```bash
# Find the process
lsof -i :5000

# Kill it
kill -9 <PID>
```

### Module Not Found Errors

```bash
rm -rf node_modules package-lock.json
npm install
```

### Schema Push Fails

```bash
# Recreate database
dropdb jobu_betting
createdb jobu_betting
npm run db:push
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "Add my feature"`
4. Push to branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

MIT License - see LICENSE file for details.

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review `LOCAL_SETUP.md` for detailed local development guidance
3. Open a GitHub issue with reproduction steps
