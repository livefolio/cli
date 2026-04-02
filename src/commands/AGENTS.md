<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-01 | Updated: 2026-04-01 -->

# commands

## Purpose
Commander.js command implementations. Each file exports a `make*Command()` factory that returns a configured `Command` instance registered by `src/index.ts`.

## Key Files

| File | Description |
|------|-------------|
| `indicator.ts` | `livefolio indicator` — fetch indicator time series (SMA, EMA, RSI, VIX, treasury rates, etc.). Also exports shared constants (`TICKER_LOOKBACK_TYPES`, `TICKER_ONLY_TYPES`, `STANDALONE_TYPES`), `resolveType()`, and `parseTicker()` used by other modules |
| `indicator.test.ts` | Unit tests for indicator command, type resolution, and ticker parsing |
| `signal.ts` | `livefolio signal` — evaluate a signal comparing two indicators with optional tolerance |
| `signal.test.ts` | Unit tests for signal command |
| `strategy.ts` | `livefolio strategy` — parent command with subcommands: `post` (create), `run` (simulate), `get` (inspect), `series` (allocation timeline). Also contains serialization functions for round-trip JSON output |
| `strategy.test.ts` | Unit tests for strategy parsing, serialization, and filtering |

## For AI Agents

### Working In This Directory
- `indicator.ts` exports shared type constants and parsing helpers — changes here affect `signal.ts`, `strategy.ts`, and `lib/parse.ts`
- `strategy.ts` is the largest file; it contains four subcommands plus serialization logic
- Each command follows the same pattern: validate args -> readEnv -> buildClient -> call SDK -> format output
- Output formats: `table` (box-drawing), `json`, `csv`

### Testing Requirements
- Each command has a co-located `.test.ts` file
- Tests cover argument parsing and edge cases; SDK calls are not tested here (integration-level)
- Run `npm test` to execute all tests

### Common Patterns
- `validateDate()` is duplicated across files (validates `YYYY-MM-DD` format)
- `formatBars()` dispatches to `lib/format.ts` helpers based on `--format` option
- Error handling: `console.error()` + `process.exit(1)` — no thrown exceptions escape to the user

### Indicator Type Categories
- **Ticker + Lookback**: SMA, EMA, RSI, Return, Volatility, Drawdown — require `<ticker>` and `<lookback>`
- **Ticker Only**: Price — requires `<ticker>`
- **Standalone**: VIX, VIX3M, T3M..T30Y — no arguments needed (treasury types need `FRED_API_KEY`)

## Dependencies

### Internal
- `../lib/client.ts` — `readEnv()`, `buildClient()`
- `../lib/format.ts` — `formatTable()`, `formatJson()`, `formatCsv()`
- `../lib/parse.ts` — `parseIndicatorSpec()`, `parseSignalSpec()`, `buildIndicatorHandle()`, `buildSignalHandle()`

### External
- `commander` — command definition
- `@livefolio/sdk` — `DailyBar`, `LivefolioClient` types

<!-- MANUAL: -->
