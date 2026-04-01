# @livefolio/cli

Command-line interface for Livefolio, built on `@livefolio/sdk`.

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

## Commands

| Command | Description | Docs |
|---------|-------------|------|
| `market series` | Fetch historical daily price series (CSV) | [docs/market.md](docs/market.md) |
| `market quotes` | Get current prices (CSV) | [docs/market.md](docs/market.md) |
| `strategy get` | Fetch a strategy definition (JSON) | [docs/strategy.md](docs/strategy.md) |
| `strategy evaluate` | Evaluate a strategy (JSON) | [docs/strategy.md](docs/strategy.md) |
| `portfolio rebalance` | Compute a rebalance plan (JSON) | [docs/portfolio.md](docs/portfolio.md) |

## Development

```bash
npm install
npm run build
npm test
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
