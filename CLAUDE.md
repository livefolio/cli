# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
npm run build        # compile TypeScript (tsc) → dist/
npm run dev          # tsc --watch
npm run start        # node dist/cli.js
npm test             # run tests (vitest)
npm run test:watch   # run tests in watch mode
```

Run locally against a Supabase instance:

```bash
# Copy and fill in .env.example → .env.local
node dist/cli.js --env .env.local market series SPY
```

## Architecture

`@livefolio/cli` is a thin command-line wrapper around `@livefolio/sdk`. It exposes SDK functionality as shell commands suitable for both human users and AI agents. Market commands output CSV; strategy commands output JSON.

### File structure

```
src/
  cli.ts                          # Entry point — Commander.js program + --env option
  config.ts                       # .env file loader + lazy LivefolioClient singleton
  lib/
    format.ts                     # Output formatters (CSV)
    format.test.ts                # Tests for formatters
  commands/
    market/
      index.ts                    # "market" subcommand registration
      series.ts                   # series <symbols...> action handler
      series.test.ts              # Tests for series action
      quote.ts                    # quotes <symbols...> action handler
      quote.test.ts               # Tests for quote action
    portfolio/
      index.ts                    # "portfolio" subcommand registration
      rebalance.ts                # rebalance action handler
      rebalance.test.ts           # Tests for rebalance action
    strategy/
      index.ts                    # "strategy" subcommand registration
      get.ts                      # get <link_id> action handler
      get.test.ts                 # Tests for get action
      evaluate.ts                 # evaluate <link_id> action handler
      evaluate.test.ts            # Tests for evaluate action
```

### Adding a new command

1. Create `src/commands/<module>/` with `index.ts` (registration) and command files
2. Register the module in `cli.ts` — call `registerX(program)` before `program.parse()`
3. Use `getLivefolio()` from `config.ts` to access SDK methods
4. For market commands, use `formatObservations()` from `lib/format.ts` for CSV output (`symbol,timestamp,price`). For strategy commands, output JSON via `JSON.stringify(result, null, 2)`.
5. Output to stdout, errors to stderr with `process.exitCode = 1`
6. **Add a `<command>.test.ts`** alongside the action handler (see Testing below)

### Relationship to other Livefolio repos

- **`@livefolio/sdk`** — The SDK this CLI wraps. All data access goes through the SDK, not direct HTTP/DB calls.
- **`@livefolio/db`** — Database types and migrations. The SDK depends on this; the CLI does not directly.
- **`app`** — The Next.js web app. Shares the SDK but is otherwise independent.

### Environment configuration

The CLI requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` to be set. Use `--env <path>` to load a `.env` file, or export them in your shell. Without either, the CLI exits with a clear error.

### Build output

TypeScript compiles to ESM (`dist/`) with declarations. Target is ES2022, module system is Node16. The `dist/cli.js` entry point has a shebang for use as a global binary.

## Testing

**Every code change must include corresponding tests.** Tests use vitest and mock `getLivefolio()` from `config.ts`.

Market command tests must cover:
- Empty input validation
- Symbol uppercasing
- Success path with single and multiple symbols
- Missing data handling (empty results, missing symbols)
- Error handling (both `Error` instances and non-Error thrown values)

Strategy command tests must cover:
- Not found (null result → stderr error, exitCode 1)
- Success path (JSON output to stdout)
- Error handling (both `Error` instances and non-Error thrown values)

Portfolio command tests must cover:
- Missing required options / invalid pair format
- Valid rebalance (triggered and not triggered)
- Threshold override
- Cash-symbol exclusion
- Error handling (both `Error` instances and non-Error thrown values)

Test files live alongside their source files (`series.test.ts` next to `series.ts`). The `tsconfig.json` excludes `*.test.ts` from the build; `vitest.config.ts` excludes `dist/` from test discovery.

## Code Conventions

- TypeScript strict mode
- ESM (`"type": "module"` in package.json)
- Commander.js for CLI parsing — nested subcommand pattern (`program → module → command`)
- CSV output to stdout — no fancy formatting, agent-parsable
- Errors to stderr with non-zero exit code
- No runtime dependencies beyond `commander`, `@livefolio/sdk`, and `@supabase/supabase-js`

## CI/CD

Two GitHub Actions workflows in `.github/workflows/`:

- **test.yml** (PR → main) — installs, builds, runs tests, checks that `package.json` version was bumped vs main
- **release.yml** (push to main) — builds, runs tests, publishes to npm, creates a GitHub release

A branch ruleset on `main` enforces: no direct pushes (PRs required), status checks must pass (`test` job), no deletions, no force pushes.

**Before merging a PR**, always run `npm version patch` (or minor/major) to bump the version. The test workflow will block the PR if you forget.

## Publishing

Published to the public npm registry as `@livefolio/cli`. The release workflow handles `npm publish` automatically on merge to main — no manual publishing needed.
