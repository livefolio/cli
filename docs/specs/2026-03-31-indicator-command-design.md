# `livefolio indicator` Command Design

## Command Signature

```
livefolio indicator <type> [ticker] [lookback] [options]
```

### Options

| Flag | Description | Default |
|---|---|---|
| `--delay <days>` | Days to delay the indicator | `0` |
| `--from <date>` | Start date for series (YYYY-MM-DD) | none (all data) |
| `--to <date>` | End date for series (YYYY-MM-DD) | none (through latest) |
| `--format <fmt>` | Output format: `table`, `json`, `csv` | `table` |

### Supported Types

Types are case-insensitive. The CLI maps lowercase input to SDK enum values.

| Category | Types | Required positional args |
|---|---|---|
| Ticker + lookback | `sma`, `ema`, `rsi`, `return`, `volatility`, `drawdown` | `<ticker>` `<lookback>` |
| Ticker only | `price` | `<ticker>` |
| Standalone | `vix`, `vix3m`, `t3m`, `t6m`, `t1y`, `t2y`, `t3y`, `t5y`, `t7y`, `t10y`, `t20y`, `t30y` | none |

Excluded types: `Threshold`, `Month`, `Day of Week`, `Day of Month`, `Day of Year`.

### Examples

```bash
livefolio indicator sma SPY 200
livefolio indicator sma SPY 200 --delay 1 --from 2025-01-01 --format csv
livefolio indicator price AAPL --from 2025-06-01 --to 2025-12-31
livefolio indicator vix
livefolio indicator t10y --format json
```

## Validation

Validated in this order:

1. **Type exists** — if not a recognized type, print available types and exit 1.
2. **Required args present** — based on category:
   - Ticker+lookback type missing args: `"Error: sma requires <ticker> and <lookback>"`
   - Ticker-only type missing ticker: `"Error: price requires <ticker>"`
   - Standalone type with extra positional args: ignored.
3. **Lookback is a positive integer** — `"Error: lookback must be a positive integer"`
4. **Date format** — `--from` / `--to` must be valid YYYY-MM-DD.
5. **Environment variables** — `SUPABASE_URL` and `SUPABASE_KEY` required. Treasury types also require `FRED_API_KEY`. Missing vars produce a specific error message.

All errors go to stderr with non-zero exit code.

## Data Flow

1. Parse args, validate, read env vars.
2. Create Supabase client from `SUPABASE_URL` + `SUPABASE_ANON_KEY`.
3. Create `LivefolioClient` via `createClient({ supabase, fredApiKey })`.
4. Call the appropriate factory method (e.g., `client.sma(ticker, lookback, { delay })`).
5. Call `.series({ from, to })` on the returned `IndicatorHandle`.
6. Format and print the `DailyBar[]` result.

Empty results: silent exit 0 (no output).

## Output Formats

**Table** (default):
```
DATE        VALUE
2025-01-02  478.32
2025-01-03  479.15
2025-01-06  480.01
```

**JSON** (`--format json`):
```json
[
  { "date": "2025-01-02", "value": 478.32 },
  { "date": "2025-01-03", "value": 479.15 }
]
```

**CSV** (`--format csv`):
```
date,value
2025-01-02,478.32
2025-01-03,479.15
```

## Project Structure

New files in `cli/src/`:

```
cli/src/
  commands/
    indicator.ts    — command registration, arg parsing, validation, action handler
  lib/
    client.ts       — creates LivefolioClient from env vars (shared by future commands)
    format.ts       — table/json/csv formatters for DailyBar[] (shared by future commands)
  index.ts          — updated to register the indicator command
```

No new dependencies. Table formatter is hand-rolled (padded columns for two columns).

## Testing

- **`commands/indicator.test.ts`** — type-to-category mapping, arg validation (required args per type, lookback validation, date format validation, case-insensitive type matching, unknown type rejection).
- **`lib/format.test.ts`** — table/json/csv output for normal data, empty arrays return empty string.

SDK integration (Supabase, data providers) is not tested at the CLI layer.

## Configuration

All configuration via environment variables:

| Variable | Required | Used by |
|---|---|---|
| `SUPABASE_URL` | Always | Supabase client |
| `SUPABASE_KEY` | Always | Supabase client |
| `FRED_API_KEY` | Treasury types only | FRED provider |
