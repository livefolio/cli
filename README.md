# @livefolio/cli

Command-line interface for Livefolio market data, built on `@livefolio/sdk`.

## Install

```bash
npm install -g @livefolio/cli
```

## Setup

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

For local development with `supabase start`, the defaults in `.env.example` work out of the box.

## Usage

```bash
# Load env and fetch historical series
livefolio --env .env.local market series SPY

# Fetch multiple symbols at once
livefolio --env .env.local market series SPY QQQ

# Get real-time quotes
livefolio --env .env.local market quotes SPY QQQ

# Output is CSV (symbol,timestamp,price), pipe-friendly
livefolio --env .env.local market series SPY | head -5
# symbol,timestamp,price
# SPY,2025-01-10T16:00:00Z,590.25
# SPY,2025-01-11T16:00:00Z,592.10
# SPY,2025-01-12T16:00:00Z,588.50

# Fetch a strategy definition
livefolio --env .env.local strategy get bCicNI7OI2x

# Evaluate a strategy (signals, allocation, indicators)
livefolio --env .env.local strategy evaluate bCicNI7OI2x

# Evaluate as of a specific date
livefolio --env .env.local strategy evaluate bCicNI7OI2x --at 2025-05-12T21:00:00Z

# With env vars exported, --env is not needed
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ANON_KEY=your-anon-key
livefolio market series SPY > spy.csv
```

## Commands

| Command | Description |
|---------|-------------|
| `market series <symbols...>` | Fetch historical daily series for one or more symbols (CSV) |
| `market quotes <symbols...>` | Get current price for one or more symbols (CSV) |
| `strategy get <link_id>` | Fetch a strategy definition and output as JSON |
| `strategy evaluate <link_id> [--at <date>]` | Evaluate a strategy and output the result as JSON |

## Development

```bash
npm install
npm run build
npm test             # run tests
node dist/cli.js --env .env.local market series SPY
```

## CI/CD

- PRs to `main` run build, tests, and enforce a version bump
- Merges to `main` auto-publish to npm and create a GitHub release

Before merging, bump the version:

```bash
npm version patch
```

## License

MIT
