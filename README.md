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

# Output is CSV, pipe-friendly
livefolio --env .env.local market series QQQ | head -5
# date,value
# 1999-03-10,1.5625
# 1999-03-11,1.546875
# 1999-03-12,1.484375
# 1999-03-15,1.5

# With env vars exported, --env is not needed
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ANON_KEY=your-anon-key
livefolio market series SPY > spy.csv
```

## Commands

| Command | Description |
|---------|-------------|
| `market series <symbol>` | Fetch historical daily series for a symbol (CSV) |

## Development

```bash
npm install
npm run build
node dist/cli.js --env .env.local market series SPY
```

## CI/CD

- PRs to `main` run build and enforce a version bump
- Merges to `main` auto-publish to npm and create a GitHub release

Before merging, bump the version:

```bash
npm version patch
```

## License

MIT
