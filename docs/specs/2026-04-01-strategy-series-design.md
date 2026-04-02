# `strategy series` Subcommand

## Summary

New `strategy series <link_id>` subcommand that displays the allocation time-series for a strategy. Read-only — fetches existing data from `strategies_series`, does not trigger evaluation.

## Command Signature

```
livefolio strategy series <link_id> [options]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--from <date>` | `YYYY-MM-DD` | earliest in DB | Start of date range |
| `--to <date>` | `YYYY-MM-DD` | latest in DB | End of date range |
| `--changes-only` | flag | off | Only show rows where allocation changed from previous row |
| `--format <fmt>` | `table\|json\|csv` | `table` | Output format |

## Data Flow

1. Build client via `readEnv()` + `buildClient(env)`
2. Call `client.strategy(linkId)` to get a `StrategyHandle` by link_id
3. Call `strategy.series({ from, to })` → returns `StrategyBar[]` (array of `{ date: string, allocation: AllocationHandle }`)
4. If `--changes-only`, filter to rows where the allocation differs from the previous row (compare by allocation ID or holdings content)
5. Format and print based on `--format`

## Output Formats

### Table (default)

Compact holdings string per row. Each allocation's holdings are formatted as `TICKER:NN%` pairs joined by `, `.

```
┌────────────┬──────────────────────────┐
│ DATE       │ ALLOCATION               │
├────────────┼──────────────────────────┤
│ 2024-01-02 │ AAPL:60%, MSFT:40%       │
│ 2024-01-03 │ AAPL:60%, MSFT:40%       │
│ 2024-01-04 │ CASHX:100%               │
└────────────┴──────────────────────────┘
```

### JSON

Structured array with holdings as objects (raw weights, not percentages):

```json
[
  { "date": "2024-01-02", "holdings": { "AAPL": 0.6, "MSFT": 0.4 } },
  { "date": "2024-01-04", "holdings": { "CASHX": 1.0 } }
]
```

### CSV

Compact holdings string (same as table column):

```
date,allocation
2024-01-02,"AAPL:60%, MSFT:40%"
2024-01-04,"CASHX:100%"
```

## Holdings Formatting

Each `AllocationHandle` has `holdings: [TickerHandle, number][]`. To produce the compact string:

1. Iterate over holdings pairs
2. For each `[ticker, weight]`: format as `${ticker.symbol}:${Math.round(weight * 100)}%`
3. If ticker has leverage !== 1, use `${symbol}?L=${leverage}` format
4. Join with `, `

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Empty series (no data) | Print `"Error: strategy has no series data. Run 'strategy run' first."`, exit 1 |
| Invalid `--from` or `--to` date | Print `"Error: --from/--to must be a valid date (YYYY-MM-DD)"`, exit 1 |
| Invalid `--format` value | Commander handles this via `.choices()` |
| SDK/DB errors | Catch, print error message, exit 1 |

## Changes-Only Filtering

When `--changes-only` is set:

1. Walk the `StrategyBar[]` array in order
2. Always include the first row
3. For subsequent rows, compare current allocation's holdings to the previous row's holdings
4. Include the row only if the holdings differ — compare by converting both allocations' `holdings` arrays to sorted `symbol:weight` strings and checking equality

## Implementation Location

- **File**: `cli/src/commands/strategy.ts`
- **Function**: `makeSeriesCommand()` returning a `Command`
- **Registration**: `cmd.addCommand(makeSeriesCommand())` in `makeStrategyCommand()`
- **No new files** — follows existing pattern alongside `makePostCommand()`, `makeRunCommand()`, `makeGetCommand()`

The compact holdings formatter is a small helper function within the same file.
