# CLI Signal Tolerance and Indicator Delay

Add per-signal tolerance and per-indicator delay to signal spec strings used by the strategy JSON format and `parseSignalSpec`.

## Syntax

### Indicator delay: `@<integer>`

Appended to an individual indicator spec. Positive = shift forward (today uses yesterday's value), negative = shift backward (today uses tomorrow's value). Must be an integer.

```
SMA SPY 200 @1          # SMA(200) delayed by 1 day
RSI QQQ 10 @-1          # RSI(10) shifted back 1 day
Price SPY @2             # price delayed by 2 days
VIX @1                   # VIX delayed by 1 day
Threshold 30             # thresholds have no delay (static value)
```

### Signal tolerance: `~<number>`

Appended to the end of the full signal spec, after both indicators and the operator. Non-negative. Floats allowed. Absolute vs relative auto-detected by SDK based on indicator type.

```
SMA SPY 50 > SMA SPY 200 ~2
```

### Combined

Delay goes on individual indicators, tolerance goes on the full signal:

```
Price SPY @1 > SMA SPY 200 ~2       # price delayed 1 day, 2% tolerance
RSI QQQ 10 @-1 < Threshold 30 ~2    # RSI shifted back, tolerance 2
SMA SPY 50 > SMA SPY 200 @1 ~2      # delay on indicator2, tolerance on signal
```

### Full grammar

```
signal_spec  := indicator_spec " " op " " indicator_spec (" ~" tolerance)?
indicator_spec := type args? (" @" delay)?
tolerance    := non-negative number (float ok)
delay        := integer (positive or negative)
op           := ">" | "<" | "="
```

## Examples in strategy JSON

```json
{
  "name": "Example",
  "rules": [
    {"when": ["Price SPY @1 > SMA SPY 200 ~2"], "hold": {"SPY": 1}},
    {"when": ["RSI QQQ 10 < Threshold 30 ~2"], "hold": {"QQQ?L=3": 1}},
    {"hold": {"CASHX": 1}}
  ]
}
```

## Changes

### 1. `cli/src/lib/parse.ts`

**IndicatorSpec** — add optional `delay` field:
```typescript
export interface IndicatorSpec {
  type: string;
  ticker?: string;
  leverage?: number;
  lookback?: number;
  value?: number;
  delay?: number;  // new
}
```

**parseIndicatorSpec()** — after parsing type/ticker/lookback, check if the last token matches `@<integer>`. Strip it and set `delay`.

**SignalSpec** — add `tolerance` field:
```typescript
export interface SignalSpec {
  indicator1: IndicatorSpec;
  indicator2: IndicatorSpec;
  comparison: Comparison;
  tolerance: number;  // new, defaults to 0
}
```

**parseSignalSpec()** — after splitting on the comparison operator, check if the right-hand side ends with `~<number>`. Strip it, parse the tolerance. Then parse both indicator specs (which now handle `@<delay>` internally).

**buildIndicatorHandle()** — pass `spec.delay` to the SDK indicator factory methods (as `{ delay: spec.delay }` opts parameter).

**buildSignalHandle()** — already accepts tolerance param, no signature change needed.

### 2. `cli/src/commands/strategy.ts`

- In `buildStrategyHandles()`, pass `sig.tolerance` to `buildSignalHandle(client, sig, sig.tolerance)`. One-line change.

### 3. Tests

- `cli/src/lib/parse.test.ts`:
  - `parseIndicatorSpec`: delay present, absent, negative, invalid (float, NaN)
  - `parseSignalSpec`: tolerance present/absent, delay on one/both indicators, combined delay+tolerance, invalid values
- `cli/src/commands/strategy.test.ts`: strategy JSON with tolerance and delay in signal specs

### Not changed

- `signal` command — already has `--tolerance` flag and doesn't use `parseSignalSpec`
- `indicator` command — already has `--delay` flag and builds handles directly
- SDK — all plumbing already exists (`buildSignalHandle` accepts tolerance, indicator factories accept `{ delay }`)
