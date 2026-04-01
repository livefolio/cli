# Strategy CLI Command — Design Spec

## Overview

A `strategy` command for the livefolio CLI with three subcommands: `post`, `run`, and `get`. Users define strategies as simplified JSON, persist them to the database, simulate them over a date range, and inspect saved strategies by link_id.

## Subcommands

### `strategy post <json>`

Creates a strategy from a simplified JSON definition and prints the resulting `link_id` to stdout.

**Arguments:**
- `<json>` — positional, required. The simplified JSON strategy definition (see schema below).

**Output:** The `link_id` string, printed to stdout with no additional formatting.

**Exit codes:** 0 on success, 1 on validation or persistence error (message to stderr).

### `strategy run <link_id>`

Loads an existing strategy by link_id, runs a simulation, and prints the result as JSON to stdout.

**Arguments:**
- `<link_id>` — positional, required.

**Options:**
- `--from <date>` — start date, YYYY-MM-DD. Optional; defaults to full available range.
- `--to <date>` — end date, YYYY-MM-DD. Optional; defaults to full available range.
- `--capital <number>` — initial capital in dollars. Required.

**Output:** Pretty-printed JSON to stdout:
```json
{
  "series": [
    { "date": "2020-01-02", "value": 100000 },
    { "date": "2020-01-03", "value": 100150 }
  ],
  "trades": [
    { "date": "2020-01-02", "symbol": "SPY", "quantity": 100, "price": 300, "action": "buy" }
  ]
}
```

Where `series` is `DailyBar[]` and `trades` is `Trade[]` from the SDK.

**Exit codes:** 0 on success, 1 on error (message to stderr).

### `strategy get <link_id>`

Loads an existing strategy by link_id and prints its definition as JSON to stdout.

**Arguments:**
- `<link_id>` — positional, required.

**Output:** The strategy row from the database as pretty-printed JSON.

**Exit codes:** 0 on success, 1 on error (message to stderr).

## Simplified JSON Schema

Input to `strategy post`:

```json
{
  "name": "Golden Cross",
  "freq": "Monthly",
  "offset": 0,
  "rules": [
    {
      "when": ["SMA SPY 50 > SMA SPY 200"],
      "hold": { "SPY": 0.6, "CASHX": 0.4 }
    },
    {
      "hold": { "CASHX": 1 }
    }
  ]
}
```

### Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | yes | — | Strategy name |
| `freq` | string | no | `"Daily"` | Trading frequency: `Daily`, `Weekly`, `Monthly`, `Quarterly`, `Yearly` |
| `offset` | number | no | `0` | Rebalance offset within period |
| `rules` | array | yes | — | At least one rule. Last rule must be fallback (no `when`). |

### Rule Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `when` | string[] | no | Array of signal specs. Omit for fallback rule. |
| `hold` | object | yes | `{ "SYMBOL": weight }` — weights must sum to 1. |

### Signal Spec Syntax

Each string in `when` follows the format: `<indicator1> <operator> <indicator2>`

**Operators:** `>`, `<`, `=` (no word aliases)

**Indicator spec:** `<type> [ticker] [lookback]`

- Ticker-bound: `SMA SPY 50`, `EMA SPY 200`, `RSI SPY 14`, `Price SPY`, `Return SPY 20`, `Volatility SPY 60`, `Drawdown SPY 252`
- Standalone: `VIX`, `VIX3M`, `T3M`, `T6M`, `T1Y`, `T2Y`, `T5Y`, `T10Y`, `T20Y`, `T30Y`
- Threshold: `Threshold 30`, `Threshold 0.05`
- Ticker leverage: `SPY?L=3`

**Examples:**
- `SMA SPY 50 > SMA SPY 200` — golden cross
- `RSI SPY 14 < Threshold 30` — oversold
- `VIX > Threshold 20` — high volatility
- `Price SPY > EMA SPY 200` — above 200-day EMA

### Hold Syntax

`{ "SYMBOL": weight, ... }` — weights must sum to 1. Ticker symbols support leverage syntax: `"SPY?L=3": 0.5`.

## Parsing & Handle Construction

When `post` receives the JSON string:

1. **Parse JSON** — validate required fields (`name`, `rules`), apply defaults (`freq`=`"Daily"`, `offset`=`0`).
2. **Validate rules** — at least one rule, last rule has no `when`, non-fallback rules have non-empty `when`.
3. **Parse each `hold`** — for each `{ symbol: weight }` entry, create `client.ticker(symbol)` (parsing leverage from `?L=N` suffix), then `client.allocation(...pairs)`.
4. **Parse each signal string** — split on ` > `, ` < `, or ` = ` to extract two indicator specs and the operator. Parse each indicator spec into an `IndicatorHandle` using the same logic as the `signal` command's `parseIndicatorSpec`. Build signal handle: `client.gt(ind1, ind2)` / `client.lt(...)` / `client.eq(...)`.
5. **Build strategy** — `client.strategy({ name, freq, offset, rules })`.
6. **Resolve** — `strategy.resolve()` persists to DB.
7. **Print** `link_id` to stdout.

## Shared Parsing Module

The signal command (`cli/src/commands/signal.ts`) already contains `parseIndicatorSpec` and indicator-building logic. This is extracted into `cli/src/lib/parse.ts` so both `signal` and `strategy` commands can reuse it.

Shared functions:
- `parseIndicatorSpec(input: string): ParsedIndicator` — parses `"SMA SPY 50"` into type/ticker/lookback
- `parseTicker(input: string): { symbol: string, leverage?: number }` — parses `"SPY?L=3"`
- `buildIndicatorHandle(client, spec): IndicatorHandle` — constructs SDK handle from parsed spec

## `run` Implementation

1. Build SDK client from environment.
2. Load strategy: `client.strategy(linkId)`.
3. If `--from` or `--to` omitted, call `strategy.series()` to get all available bars, then use the first bar's date as `from` and/or the last bar's date as `to`.
4. Build starting portfolio: `client.portfolio([client.ticker("CASHX"), capital])` — all-cash.
5. Simulate: `strategy.simulate({ from, to, portfolio })`.
6. Print `JSON.stringify({ series: sim.series, trades: sim.trades }, null, 2)`.

## `get` Implementation

1. Build SDK client from environment.
2. Load strategy: `client.strategy(linkId)`.
3. Resolve: `strategy.resolve()` to fetch the DB row.
4. Print `JSON.stringify(row, null, 2)`.

## Error Handling

Follows existing CLI patterns:
- Validation errors (bad JSON, missing fields, invalid signal syntax, weights not summing to 1) log to stderr and exit(1).
- SDK/network errors caught at top level, logged to stderr, exit(1).

## File Structure

```
cli/src/commands/strategy.ts    — command definition with post/run/get subcommands
cli/src/lib/parse.ts            — shared parsing (extracted from signal.ts)
cli/src/commands/signal.ts      — updated to import from lib/parse.ts
cli/src/index.ts                — register strategy command
```
