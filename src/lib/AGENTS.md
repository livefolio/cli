<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-01 | Updated: 2026-04-01 -->

# lib

## Purpose
Shared utilities used across all CLI commands: Supabase client construction, output formatting, and indicator/signal spec parsing with SDK handle building.

## Key Files

| File | Description |
|------|-------------|
| `client.ts` | `readEnv()` reads `SUPABASE_URL`, `SUPABASE_KEY`, `FRED_API_KEY` from env; `buildClient()` creates a `LivefolioClient` from the SDK |
| `format.ts` | `formatTable()`, `formatJson()`, `formatCsv()` — convert `DailyBar[]` to display strings; table uses Unicode box-drawing characters |
| `format.test.ts` | Unit tests for all three format functions |
| `parse.ts` | Core parsing engine: `parseIndicatorSpec()` tokenizes indicator strings, `parseSignalSpec()` splits on operators (`>`, `<`, `=`) with tolerance (`~N`); `buildIndicatorHandle()` and `buildSignalHandle()` map parsed specs to SDK method calls |
| `parse.test.ts` | Unit tests for indicator/signal parsing and edge cases |

## For AI Agents

### Working In This Directory
- `parse.ts` imports type constants from `commands/indicator.ts` — this is a deliberate circular-ish dependency (commands -> lib -> commands); be careful when refactoring
- `client.ts` is the only file that touches environment variables
- `format.ts` only handles `DailyBar` (date + value); strategy series formatting lives in `commands/strategy.ts`

### Testing Requirements
- Tests are co-located as `*.test.ts`
- `parse.test.ts` covers all indicator type categories and edge cases (invalid inputs, delay tokens, tolerance)
- `format.test.ts` covers empty arrays, single rows, and multi-row output

### Common Patterns
- Indicator spec string format: `"<Type> [<Ticker>] [<Lookback>] [@<Delay>]"` (e.g., `"SMA SPY 200 @1"`)
- Signal spec string format: `"<Indicator> <op> <Indicator> [~<Tolerance>]"` (e.g., `"Price SPY > SMA SPY 200 ~2"`)
- `needsFredKey()` checks if a spec references treasury types requiring `FRED_API_KEY`

## Dependencies

### Internal
- `../commands/indicator.ts` — `resolveType()`, `parseTicker()`, type constant arrays

### External
- `@supabase/supabase-js` — Supabase client creation (in `client.ts`)
- `@livefolio/sdk` — `createClient`, `LivefolioClient`, `DailyBar`, `Database` types

<!-- MANUAL: -->
