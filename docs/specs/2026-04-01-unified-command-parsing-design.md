# Unified Command Parsing

Replace multi-argument indicator and signal commands with single-string specs that delegate to the shared parsers in parse.ts.

## Before / After

### Indicator command

```bash
# Before:
livefolio indicator sma SPY 200 --delay 1 --from 2024-01-01 --format table

# After:
livefolio indicator "SMA SPY 200 @1" --from 2024-01-01 --format table
```

Single `<spec>` argument parsed by `parseIndicatorSpec` from `cli/src/lib/parse.ts`. Handle built by `buildIndicatorHandle` from the same file.

**Kept options:** `--from`, `--to`, `--format`, `--latest`
**Dropped:** `--delay`, `[ticker]` arg, `[lookback]` arg

### Signal command

```bash
# Before:
livefolio signal gt "price SPY" "sma SPY 200" --tolerance 2 --from 2024-01-01 --format json

# After:
livefolio signal "Price SPY > SMA SPY 200 ~2" --from 2024-01-01 --format json
```

Single `<spec>` argument parsed by `parseSignalSpec` from `cli/src/lib/parse.ts`. Handle built by `buildSignalHandle` from the same file.

**Kept options:** `--from`, `--to`, `--format`, `--latest`
**Dropped:** `--tolerance`, `<comparison>` arg, `<indicator1>` arg, `<indicator2>` arg

## Changes

### 1. `cli/src/commands/indicator.ts`

Rewrite the command definition:
- Single `.argument("<spec>", "indicator spec string")` replacing `<type>`, `[ticker]`, `[lookback]`
- Remove `--delay` option
- Replace all manual argument validation and handle construction with `parseIndicatorSpec(spec)` → `buildIndicatorHandle(client, spec)`
- Keep the `--from`, `--to`, `--format`, `--latest` options and all output formatting logic
- Keep all exports used by parse.ts: `parseTicker`, `resolveType`, `TICKER_LOOKBACK_TYPES`, `TICKER_ONLY_TYPES`, `STANDALONE_TYPES`, `getAllTypes`
- Remove dead code: `validateArgs` function and internal argument routing logic

### 2. `cli/src/commands/signal.ts`

Rewrite the command definition:
- Single `.argument("<spec>", "signal spec string")` replacing `<comparison>`, `<indicator1>`, `<indicator2>`
- Remove `--tolerance` option
- Replace `validateSignalArgs`, `resolveComparison`, manual indicator construction, and tolerance parsing with `parseSignalSpec(spec)` → `buildSignalHandle(client, spec, spec.tolerance)`
- Keep `--from`, `--to`, `--format`, `--latest` options and all output formatting logic
- Remove dead code: `validateSignalArgs`, `resolveComparison`

### 3. `cli/src/commands/indicator.test.ts`

Rewrite tests for the new single-string interface. Focus on:
- Valid indicator spec strings produce correct output
- Invalid spec strings throw appropriate errors
- FRED_API_KEY requirement for treasury types
- `--from`, `--to`, `--format`, `--latest` options still work

### 4. `cli/src/commands/signal.test.ts`

Rewrite tests for the new single-string interface. Focus on:
- Valid signal spec strings produce correct output
- Invalid spec strings throw appropriate errors
- Tolerance and delay in spec strings
- FRED_API_KEY requirement for treasury indicators in signals
- `--from`, `--to`, `--format`, `--latest` options still work

### Not changed

- `cli/src/lib/parse.ts` — no changes, already has all needed parsers
- `cli/src/commands/strategy.ts` — no changes, already uses parse.ts
- SDK — no changes
