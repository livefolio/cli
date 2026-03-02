# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
npm run build        # compile TypeScript (tsc) → dist/
npm run dev          # tsc --watch
npm run start        # node dist/cli.js
```

Run locally against a Supabase instance:

```bash
# Copy and fill in .env.example → .env.local
node dist/cli.js --env .env.local market series SPY
```

## Architecture

`@livefolio/cli` is a thin command-line wrapper around `@livefolio/sdk`. It exposes SDK functionality as shell commands with CSV output suitable for both human users and AI agents.

### File structure

```
src/
  cli.ts                          # Entry point — Commander.js program + --env option
  config.ts                       # .env file loader + lazy LivefolioClient singleton
  lib/
    format.ts                     # Output formatters (CSV)
  commands/
    market/
      index.ts                    # "market" subcommand registration
      series.ts                   # series <symbol> action handler
```

### Adding a new command

1. Create `src/commands/<module>/` with `index.ts` (registration) and command files
2. Register the module in `cli.ts` — call `registerX(program)` before `program.parse()`
3. Use `getLivefolio()` from `config.ts` to access SDK methods
4. Output CSV to stdout, errors to stderr with `process.exitCode = 1`

### Relationship to other Livefolio repos

- **`@livefolio/sdk`** — The SDK this CLI wraps. All data access goes through the SDK, not direct HTTP/DB calls.
- **`@livefolio/db`** — Database types and migrations. The SDK depends on this; the CLI does not directly.
- **`app`** — The Next.js web app. Shares the SDK but is otherwise independent.

### Environment configuration

The CLI requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` to be set. Use `--env <path>` to load a `.env` file, or export them in your shell. Without either, the CLI exits with a clear error.

### Build output

TypeScript compiles to ESM (`dist/`) with declarations. Target is ES2022, module system is Node16. The `dist/cli.js` entry point has a shebang for use as a global binary.

## Code Conventions

- TypeScript strict mode
- ESM (`"type": "module"` in package.json)
- Commander.js for CLI parsing — nested subcommand pattern (`program → module → command`)
- CSV output to stdout — no fancy formatting, agent-parsable
- Errors to stderr with non-zero exit code
- No runtime dependencies beyond `commander`, `@livefolio/sdk`, and `@supabase/supabase-js`

## CI/CD

Two GitHub Actions workflows in `.github/workflows/`:

- **test.yml** (PR → main) — installs, builds, checks that `package.json` version was bumped vs main
- **release.yml** (push to main) — builds, publishes to npm, creates a GitHub release

**Before merging a PR**, always run `npm version patch` (or minor/major) to bump the version. The test workflow will block the PR if you forget.

## Publishing

Published to the public npm registry as `@livefolio/cli`. The release workflow handles `npm publish` automatically on merge to main — no manual publishing needed.
