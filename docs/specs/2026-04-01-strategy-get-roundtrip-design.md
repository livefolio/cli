# Strategy Get Round-Trip Output — Design Spec

## Overview

Change `strategy get <link_id>` to output the post-compatible JSON shape instead of the raw database row. The output must be strictly round-trippable: piping `strategy get <id>` into `strategy post` creates a functionally identical strategy.

## Current Behavior

```json
{
  "id": 1,
  "link_id": "KtD_EUDeUg77VUV118Fm1",
  "name": "Newest",
  "trading_freq": "Daily",
  "trading_offset": 0,
  "definition": {
    "rules": [
      { "signalIds": [1], "allocationId": 2 },
      { "signalIds": [3], "allocationId": 3 },
      { "signalIds": [2], "allocationId": 4 },
      { "signalIds": [], "allocationId": 1 }
    ]
  },
  "created_at": "2026-04-02T02:04:25.740338+00:00"
}
```

## Target Behavior

```json
{
  "name": "Newest",
  "freq": "Daily",
  "offset": 0,
  "rules": [
    {
      "when": ["RSI QQQ?L=3 10 > Threshold 80 ~2"],
      "hold": { "UVIX": 1 }
    },
    {
      "when": ["Price SPY > SMA SPY 200 ~2"],
      "hold": { "GLD?L=2": 0.25, "QQQ?L=2": 0.75 }
    },
    {
      "when": ["RSI QQQ 10 < Threshold 30 ~2"],
      "hold": { "QQQ?L=3": 1 }
    },
    {
      "hold": { "CASHX": 1 }
    }
  ]
}
```

No `id`, `link_id`, `created_at`, or `definition` fields. No metadata — strictly the `parseStrategyJson` input shape.

## Approach

Implement serialization in the CLI layer (`cli/src/commands/strategy.ts`), not the SDK. The spec-string format is a CLI concern. The SDK already hydrates the full handle tree on `resolve()` via `_doResolveReference`.

## Serialization Rules

### Ticker String

Given a `TickerHandle` with `.symbol` and `.leverage`:
- If leverage is 1 (default): `"SPY"`
- If leverage ≠ 1: `"SPY?L=3"`

### Indicator Spec String

Given an `IndicatorHandle`:

| Category | Types | Format |
|----------|-------|--------|
| Ticker + lookback | `SMA`, `EMA`, `RSI`, `Return`, `Volatility`, `Drawdown` | `"TYPE TICKER LOOKBACK"` |
| Ticker only | `Price` | `"Price TICKER"` |
| Standalone | `VIX`, `VIX3M`, `T3M`..`T30Y` | `"TYPE"` |
| Threshold | `Threshold` | `"Threshold VALUE"` |

Append ` @DELAY` if `.delay ≠ 0`.

Examples:
- `"SMA SPY 200"`
- `"RSI QQQ?L=3 10"`
- `"Price SPY @1"`
- `"VIX"`
- `"Threshold 80"`

### Signal Spec String

Given a `SignalHandle` with `.indicator1`, `.indicator2`, `.comparison`, `.tolerance`:

```
<indicator1_spec> <comparison> <indicator2_spec>[ ~TOLERANCE]
```

Omit the `~TOLERANCE` suffix when tolerance is 0.

Examples:
- `"Price SPY > SMA SPY 200 ~2"`
- `"RSI QQQ 10 < Threshold 30 ~2"`
- `"VIX > Threshold 20"`

### Hold Map

Given an `AllocationHandle` with `.holdings` (array of `[TickerHandle, weight]`):

```json
{ "TICKER": weight, ... }
```

Ticker keys use the ticker string format above. Weights are numbers summing to 1.

### Strategy JSON

```json
{
  "name": "<strategy name>",
  "freq": "<trading freq>",
  "offset": <trading offset>,
  "rules": [
    { "when": ["<signal spec>", ...], "hold": { ... } },
    ...
    { "hold": { ... } }
  ]
}
```

- The last rule (fallback) has no `when` field.
- `freq` defaults to `"Daily"` — always include it for explicitness.
- `offset` defaults to `0` — always include it for explicitness.

## Implementation Location

All serialization functions go in `cli/src/commands/strategy.ts` alongside the existing `parseStrategyJson`, `buildStrategyHandles`, and `formatHoldings` functions. They are the inverse of the parse functions.

New functions:
- `serializeTickerSpec(ticker: TickerHandle): string`
- `serializeIndicatorSpec(indicator: IndicatorHandle): string`
- `serializeSignalSpec(signal: SignalHandle): string`
- `serializeHoldMap(allocation: AllocationHandle): Record<string, number>`
- `serializeStrategy(strategy: StrategyHandle): object` — assembles the full post-compatible JSON

## Changes to `makeGetCommand`

Replace the current action (which prints `JSON.stringify(row)`) with:

1. Call `strategy.resolve()` to hydrate the handle tree
2. Call `serializeStrategy(strategy)` to build the post-compatible object
3. Print `JSON.stringify(result, null, 2)` to stdout

## Access to Private Fields

`StrategyHandle._rules`, `._name`, `._freq`, `._offset` are private. Two options:

**Option 1**: Add public read-only getters on `StrategyHandle` — `.name`, `.freq`, `.offset` already exist. `.rules` also exists as a public getter. So no SDK changes needed.

**Option 2**: Access via the existing public getters after `resolve()`.

Use option 2 — the getters already exist.

## Testing

Add tests for each serialization function in `cli/src/commands/strategy.test.ts`. Test round-trip: parse → serialize → compare with original input string.

## Non-Goals

- No SDK changes
- No changes to `strategy post`, `strategy run`, or `strategy series`
- No support for `derived_signals` (not used in current strategies)
