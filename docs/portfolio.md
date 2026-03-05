# portfolio

Portfolio management commands. Output is JSON.

These are pure computations — no Supabase connection needed.

---

## `portfolio rebalance`

Compute a rebalance plan given target allocation weights, current holding values, and prices. Calculates portfolio drift, determines whether rebalancing is triggered (based on a configurable threshold), and outputs the buy/sell orders needed to reach the target allocation.

```bash
livefolio portfolio rebalance \
  --targets "SPY:60,QQQ:40" \
  --current "SPY:800,QQQ:200" \
  --prices "SPY:450,QQQ:380" \
  --cash 100 --total 1100
```

| Option | Required | Description |
|--------|----------|-------------|
| `--targets <pairs>` | Yes | Target weights as `SYMBOL:WEIGHT,...` — percentages that sum to ≤100 (e.g. `SPY:60,QQQ:40`) |
| `--current <pairs>` | Yes | Current holding values as `SYMBOL:VALUE,...` — dollar value of each position (e.g. `SPY:800,QQQ:200`) |
| `--prices <pairs>` | Yes | Current prices as `SYMBOL:PRICE,...` — dollar price per share, used to compute order quantities (e.g. `SPY:450,QQQ:380`) |
| `--cash <number>` | Yes | Available cash in the portfolio (dollars) |
| `--total <number>` | Yes | Total portfolio value including cash (dollars) |
| `--threshold <number>` | No | Drift threshold in percentage points before rebalancing triggers. Default: `25`. |
| `--cash-symbol <symbol>` | No | Treat this symbol as cash — no orders will be generated for it |

Symbols should be **tradable tickers** (e.g. `SPY`, `QQQ`), not simulated strategy symbols.

### Input validation

- **Strict numeric parsing** — values must be exact numbers. Trailing characters like `"10abc"` or `"10%"` are rejected (unlike `parseFloat`, which would silently accept them as `10`).
- **Whitespace trimming** — spaces around symbols and values are trimmed, so `"SPY:60, QQQ:40"` and `" spy : 60 "` both work correctly.
- **Duplicate detection** — repeating a symbol in the same option (e.g. `--targets "SPY:60,SPY:40"`) is an error.
