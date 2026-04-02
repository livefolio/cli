# `strategy series` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `strategy series` CLI subcommand that displays the allocation time-series for a strategy.

**Architecture:** New `makeSeriesCommand()` function in the existing `cli/src/commands/strategy.ts`, following the same pattern as `makePostCommand()`, `makeRunCommand()`, and `makeGetCommand()`. Two helper functions for formatting: `formatHoldings()` for compact string representation, and `filterChangesOnly()` for the `--changes-only` flag. Tests in `cli/src/commands/strategy.test.ts`.

**Tech Stack:** TypeScript, commander, @livefolio/sdk (`StrategyHandle.series()`, `AllocationHandle`, `TickerHandle`)

---

### Task 1: Holdings formatter + tests

**Files:**
- Modify: `cli/src/commands/strategy.ts` (add `formatHoldings` export)
- Modify: `cli/src/commands/strategy.test.ts` (add tests)

- [ ] **Step 1: Write the failing tests for `formatHoldings`**

Add to the bottom of `cli/src/commands/strategy.test.ts`:

```typescript
import { formatHoldings } from "./strategy.js";

describe("formatHoldings", () => {
  it("formats single holding as TICKER:NN%", () => {
    const holdings: [{ symbol: string; leverage: number }, number][] = [
      [{ symbol: "CASHX", leverage: 1 }, 1],
    ];
    expect(formatHoldings(holdings)).toBe("CASHX:100%");
  });

  it("formats multiple holdings joined by comma-space", () => {
    const holdings: [{ symbol: string; leverage: number }, number][] = [
      [{ symbol: "AAPL", leverage: 1 }, 0.6],
      [{ symbol: "MSFT", leverage: 1 }, 0.4],
    ];
    expect(formatHoldings(holdings)).toBe("AAPL:60%, MSFT:40%");
  });

  it("includes leverage when not 1", () => {
    const holdings: [{ symbol: string; leverage: number }, number][] = [
      [{ symbol: "SPY", leverage: 3 }, 0.5],
      [{ symbol: "CASHX", leverage: 1 }, 0.5],
    ];
    expect(formatHoldings(holdings)).toBe("SPY?L=3:50%, CASHX:50%");
  });

  it("rounds percentages to nearest integer", () => {
    const holdings: [{ symbol: string; leverage: number }, number][] = [
      [{ symbol: "SPY", leverage: 1 }, 0.333],
      [{ symbol: "QQQ", leverage: 1 }, 0.667],
    ];
    expect(formatHoldings(holdings)).toBe("SPY:33%, QQQ:67%");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd cli && npx vitest run src/commands/strategy.test.ts`
Expected: FAIL — `formatHoldings` is not exported from `strategy.js`

- [ ] **Step 3: Implement `formatHoldings`**

Add to `cli/src/commands/strategy.ts`, after the existing `buildStrategyHandles` function (around line 138):

```typescript
export function formatHoldings(
  holdings: [{ symbol: string; leverage: number }, number][],
): string {
  return holdings
    .map(([ticker, weight]) => {
      const label =
        ticker.leverage !== 1
          ? `${ticker.symbol}?L=${ticker.leverage}`
          : ticker.symbol;
      return `${label}:${Math.round(weight * 100)}%`;
    })
    .join(", ");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd cli && npx vitest run src/commands/strategy.test.ts`
Expected: All `formatHoldings` tests PASS

- [ ] **Step 5: Commit**

```bash
cd cli && git add src/commands/strategy.ts src/commands/strategy.test.ts && git commit -m "feat(cli): add formatHoldings helper for compact allocation display"
```

---

### Task 2: Changes-only filter + tests

**Files:**
- Modify: `cli/src/commands/strategy.ts` (add `filterChangesOnly` export)
- Modify: `cli/src/commands/strategy.test.ts` (add tests)

- [ ] **Step 1: Write the failing tests for `filterChangesOnly`**

Add to `cli/src/commands/strategy.test.ts`:

```typescript
import { formatHoldings, filterChangesOnly } from "./strategy.js";

describe("filterChangesOnly", () => {
  // Helper to create a bar-like object with holdings
  function bar(
    date: string,
    holdings: [{ symbol: string; leverage: number }, number][],
  ) {
    return { date, holdings };
  }

  it("returns empty array for empty input", () => {
    expect(filterChangesOnly([])).toEqual([]);
  });

  it("always includes the first row", () => {
    const bars = [bar("2024-01-01", [[{ symbol: "SPY", leverage: 1 }, 1]])];
    expect(filterChangesOnly(bars)).toEqual(bars);
  });

  it("filters out consecutive identical allocations", () => {
    const h = [[{ symbol: "SPY", leverage: 1 }, 1]] as [
      { symbol: string; leverage: number },
      number,
    ][];
    const bars = [bar("2024-01-01", h), bar("2024-01-02", h), bar("2024-01-03", h)];
    const result = filterChangesOnly(bars);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2024-01-01");
  });

  it("includes rows where allocation changes", () => {
    const h1 = [[{ symbol: "SPY", leverage: 1 }, 1]] as [
      { symbol: string; leverage: number },
      number,
    ][];
    const h2 = [[{ symbol: "CASHX", leverage: 1 }, 1]] as [
      { symbol: string; leverage: number },
      number,
    ][];
    const bars = [bar("2024-01-01", h1), bar("2024-01-02", h1), bar("2024-01-03", h2)];
    const result = filterChangesOnly(bars);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2024-01-01");
    expect(result[1].date).toBe("2024-01-03");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd cli && npx vitest run src/commands/strategy.test.ts`
Expected: FAIL — `filterChangesOnly` is not exported

- [ ] **Step 3: Implement `filterChangesOnly`**

The function takes an array of objects with `{ date, holdings }` and returns only the rows where the allocation changed. It needs to work with the shape we'll extract from `StrategyBar[]` — specifically the holdings arrays from each `AllocationHandle`.

Add to `cli/src/commands/strategy.ts`, after `formatHoldings`:

```typescript
interface SeriesRow {
  date: string;
  holdings: [{ symbol: string; leverage: number }, number][];
}

function holdingsKey(holdings: [{ symbol: string; leverage: number }, number][]): string {
  return holdings
    .map(([t, w]) => {
      const label = t.leverage !== 1 ? `${t.symbol}?L=${t.leverage}` : t.symbol;
      return `${label}=${w}`;
    })
    .sort()
    .join("|");
}

export function filterChangesOnly<T extends SeriesRow>(bars: T[]): T[] {
  if (bars.length === 0) return [];
  const result: T[] = [bars[0]];
  let prevKey = holdingsKey(bars[0].holdings);
  for (let i = 1; i < bars.length; i++) {
    const key = holdingsKey(bars[i].holdings);
    if (key !== prevKey) {
      result.push(bars[i]);
      prevKey = key;
    }
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd cli && npx vitest run src/commands/strategy.test.ts`
Expected: All `filterChangesOnly` tests PASS

- [ ] **Step 5: Commit**

```bash
cd cli && git add src/commands/strategy.ts src/commands/strategy.test.ts && git commit -m "feat(cli): add filterChangesOnly helper for allocation change detection"
```

---

### Task 3: `makeSeriesCommand` implementation

**Files:**
- Modify: `cli/src/commands/strategy.ts` (add `makeSeriesCommand`, register it in `makeStrategyCommand`)

- [ ] **Step 1: Implement `makeSeriesCommand`**

Add to `cli/src/commands/strategy.ts`, before `makeStrategyCommand()`:

```typescript
function makeSeriesCommand(): Command {
  return new Command("series")
    .description("Show allocation time-series for a strategy")
    .argument("<link_id>", "strategy link_id")
    .option("--from <date>", "start date (YYYY-MM-DD)")
    .option("--to <date>", "end date (YYYY-MM-DD)")
    .option("--changes-only", "only show rows where allocation changed", false)
    .option("--format <fmt>", "output format", "table")
    .addHelpText("after", "\nFormat choices: table, json, csv")
    .action(async (linkId: string, opts) => {
      if (opts.from && !validateDate(opts.from)) {
        console.error("Error: --from must be a valid date (YYYY-MM-DD)");
        process.exit(1);
      }
      if (opts.to && !validateDate(opts.to)) {
        console.error("Error: --to must be a valid date (YYYY-MM-DD)");
        process.exit(1);
      }

      const validFormats = new Set(["table", "json", "csv"]);
      if (!validFormats.has(opts.format)) {
        console.error(
          `Error: --format must be one of: ${[...validFormats].join(", ")}`,
        );
        process.exit(1);
      }

      let env;
      try {
        env = readEnv();
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }

      const client = buildClient(env);

      try {
        const strategy = client.strategy(linkId);
        const range: { from?: string; to?: string } = {};
        if (opts.from) range.from = opts.from;
        if (opts.to) range.to = opts.to;

        const bars = await strategy.series(
          Object.keys(range).length > 0 ? range : undefined,
        );

        if (bars.length === 0) {
          console.error(
            "Error: strategy has no series data. Run 'strategy run' first.",
          );
          process.exit(1);
        }

        // Extract holdings from each bar
        let rows = bars.map((b) => ({
          date: b.date,
          holdings: b.allocation.holdings.map(
            ([t, w]) =>
              [{ symbol: t.symbol, leverage: t.leverage }, w] as [
                { symbol: string; leverage: number },
                number,
              ],
          ),
        }));

        if (opts.changesOnly) {
          rows = filterChangesOnly(rows);
        }

        if (opts.format === "json") {
          const jsonRows = rows.map((r) => {
            const holdings: Record<string, number> = {};
            for (const [t, w] of r.holdings) {
              const key =
                t.leverage !== 1 ? `${t.symbol}?L=${t.leverage}` : t.symbol;
              holdings[key] = w;
            }
            return { date: r.date, holdings };
          });
          console.log(JSON.stringify(jsonRows, null, 2));
        } else if (opts.format === "csv") {
          console.log("date,allocation");
          for (const row of rows) {
            const alloc = formatHoldings(row.holdings);
            console.log(`${row.date},"${alloc}"`);
          }
        } else {
          // table format
          const allocStrs = rows.map((r) => formatHoldings(r.holdings));
          const allocWidth = Math.max(10, ...allocStrs.map((s) => s.length));
          const dateWidth = 10;

          const h = "─";
          const top = `┌${h.repeat(dateWidth + 2)}┬${h.repeat(allocWidth + 2)}┐`;
          const mid = `├${h.repeat(dateWidth + 2)}┼${h.repeat(allocWidth + 2)}┤`;
          const bot = `└${h.repeat(dateWidth + 2)}┴${h.repeat(allocWidth + 2)}┘`;
          const header = `│ ${"DATE".padEnd(dateWidth)} │ ${"ALLOCATION".padEnd(allocWidth)} │`;

          const tableRows = rows.map(
            (r, i) =>
              `│ ${r.date} │ ${allocStrs[i].padEnd(allocWidth)} │`,
          );

          console.log(
            [top, header, mid, ...tableRows, bot].join("\n"),
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 2: Register the command**

In the `makeStrategyCommand()` function at the bottom of the file, add the new subcommand. Change:

```typescript
export function makeStrategyCommand(): Command {
  const cmd = new Command("strategy").description(
    "Create, simulate, and inspect strategies",
  );
  cmd.addCommand(makePostCommand());
  cmd.addCommand(makeRunCommand());
  cmd.addCommand(makeGetCommand());
  return cmd;
}
```

To:

```typescript
export function makeStrategyCommand(): Command {
  const cmd = new Command("strategy").description(
    "Create, simulate, and inspect strategies",
  );
  cmd.addCommand(makePostCommand());
  cmd.addCommand(makeRunCommand());
  cmd.addCommand(makeGetCommand());
  cmd.addCommand(makeSeriesCommand());
  return cmd;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd cli && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Verify all existing tests still pass**

Run: `cd cli && npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd cli && git add src/commands/strategy.ts && git commit -m "feat(cli): add strategy series subcommand for allocation time-series display"
```

---

### Self-Review

**Spec coverage:**
- Command signature with `--from`, `--to`, `--changes-only`, `--format` → Task 3
- Holdings formatting (compact string, leverage support) → Task 1
- Changes-only filtering → Task 2
- Table/JSON/CSV output → Task 3
- Error handling (empty series, invalid dates, SDK errors) → Task 3
- Read-only (no sync) → Task 3 uses `strategy.series()` only

**Placeholder scan:** No TBDs, TODOs, or "add appropriate" language. All code blocks are complete.

**Type consistency:** `formatHoldings` takes `[{ symbol: string; leverage: number }, number][]` — matches the shape extracted from `AllocationHandle.holdings` (which is `[TickerHandle, number][]` where `TickerHandle` has readonly `symbol` and `leverage`). `filterChangesOnly` uses `SeriesRow` interface which matches the mapped shape in Task 3. `holdingsKey` sorts by the same `symbol?L=leverage=weight` format used in the SDK's `_doResolve`.
