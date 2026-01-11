# Local Development Setup Guide (macOS)

This guide walks you through running the Jobu Sports Betting Analytics platform locally on your MacBook.

## Prerequisites

### 1. Install Homebrew (if not already installed)
Open Terminal and run:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install Node.js 20+
```bash
brew install node@20
```

Verify installation:
```bash
node --version  # Should show v20.x.x or higher
npm --version
```

### 3. Install PostgreSQL
```bash
brew install postgresql@15
brew services start postgresql@15
```

Add to your PATH (add this to ~/.zshrc or ~/.bash_profile):
```bash
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
```

Then reload your shell:
```bash
source ~/.zshrc
```

## Setup Steps

### Step 1: Clone the Repository

First, connect your Replit project to GitHub (if not already done):
1. In Replit, go to the Git panel (Version Control)
2. Click "Connect to GitHub" and authorize
3. Create a new repository or connect to existing one

Then on your MacBook:
```bash
# Navigate to where you want the project
cd ~/Projects  # or your preferred directory

# Clone your repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Enter the project directory
cd YOUR_REPO_NAME
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Create the Database
```bash
# Create a new PostgreSQL database
createdb jobu_betting

# Verify it was created
psql -l | grep jobu_betting
```

### Step 4: Set Up Environment Variables

Create a `.env` file in the project root:
```bash
touch .env
```

Add the following content to `.env`:
```env
# Database connection
DATABASE_URL=postgresql://localhost:5432/jobu_betting

# Session secret (generate a random string)
SESSION_SECRET=your-random-secret-key-here-make-it-long

# Optional: For AI pattern discovery features
# OPENAI_API_KEY=sk-your-openai-api-key
```

To generate a random secret:
```bash
openssl rand -hex 32
```

### Step 5: Push Database Schema
```bash
npm run db:push
```

You should see output confirming tables were created.

### Step 6: Start the Development Server
```bash
npm run dev
```

You should see:
```
[express] serving on port 5000
```

### Step 7: Open in Browser

Open your browser and go to:
```
http://localhost:5000
```

## Troubleshooting

### PostgreSQL Connection Issues

If you get a connection error:
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Restart if needed
brew services restart postgresql@15

# Check connection manually
psql -d jobu_betting -c "SELECT 1"
```

### Port Already in Use

If port 5000 is in use:
```bash
# Find what's using the port
lsof -i :5000

# Kill the process
kill -9 <PID>
```

Or modify the port in `server/index.ts`.

### Node Module Issues

If you get module errors:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Database Schema Issues

If tables aren't created properly:
```bash
# Drop and recreate the database
dropdb jobu_betting
createdb jobu_betting
npm run db:push
```

## Syncing Changes

### Pull Latest from Replit/GitHub
```bash
git pull origin main
npm install  # In case dependencies changed
npm run db:push  # In case schema changed
```

### Push Local Changes to GitHub
```bash
git add .
git commit -m "Your commit message"
git push origin main
```

Changes will sync back to Replit automatically if connected.

## Features Available Locally

| Feature | Works Locally | Notes |
|---------|--------------|-------|
| Dashboard | Yes | Full functionality |
| Data Upload (Excel) | Yes | Upload team stats |
| Opportunities | Yes | View betting opportunities |
| RLM Signals | Yes | Reverse line movement detection |
| Backtesting | Yes | Historical signal testing |
| Data Sources | Yes | Manual refresh only |
| Jobu Algorithms | Yes | All sport variants |
| AI Pattern Discovery | Requires API Key | Add OPENAI_API_KEY to .env |

## Quick Commands Reference

```bash
# Start development server
npm run dev

# Push database changes
npm run db:push

# View database tables (PostgreSQL)
psql -d jobu_betting -c "\dt"

# Check server logs
# Logs appear directly in terminal when running npm run dev
```
