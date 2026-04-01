# Unified Command Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace multi-argument indicator and signal commands with single-string spec arguments that delegate to the shared parsers in parse.ts.

**Architecture:** Rewrite each command's argument definition to take a single `<spec>` string. Replace internal validation and handle construction with calls to `parseIndicatorSpec`/`parseSignalSpec` and `buildIndicatorHandle`/`buildSignalHandle` from parse.ts. Remove dead code. Rewrite tests.

**Tech Stack:** TypeScript, Vitest, Commander.js CLI

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `cli/src/commands/indicator.ts` | Modify | Rewrite command to single `<spec>` arg; remove `validateArgs`, `getAllTypes`, `--delay`; keep type constants and exports |
| `cli/src/commands/indicator.test.ts` | Modify | Remove `validateArgs` tests; keep `resolveType` and `parseTicker` tests |
| `cli/src/commands/signal.ts` | Modify | Rewrite command to single `<spec>` arg; remove `resolveComparison`, `validateSignalArgs`, `--tolerance`, multi-arg parsing |
| `cli/src/commands/signal.test.ts` | Modify | Remove `resolveComparison` and `validateSignalArgs` tests; keep `parseIndicatorSpec` tests |

---

### Task 1: Rewrite indicator command

**Files:**
- Modify: `cli/src/commands/indicator.ts`
- Modify: `cli/src/commands/indicator.test.ts`

- [ ] **Step 1: Rewrite indicator.ts command**

Replace the `makeIndicatorCommand` function and remove `validateArgs` and `getAllTypes`. Keep all type constant exports, `resolveType`, `parseTicker`, and the `TREASURY_TYPES` set. The new command takes a single `<spec>` string.

Replace `makeIndicatorCommand` in `cli/src/commands/indicator.ts` with:

```typescript
export function makeIndicatorCommand(): Command {
  const cmd = new Command("indicator")
    .description("Fetch indicator time series data")
    .argument("<spec>", 'indicator spec (e.g. "SMA SPY 200", "VIX @1")')
    .option("--from <date>", "start date (YYYY-MM-DD)")
    .option("--to <date>", "end date (YYYY-MM-DD)")
    .option("--format <fmt>", "output format: table, json, csv", "table")
    .action(async (specArg: string, opts) => {
      if (opts.from && !validateDate(opts.from)) {
        console.error("Error: --from must be a valid date (YYYY-MM-DD)");
        process.exit(1);
      }
      if (opts.to && !validateDate(opts.to)) {
        console.error("Error: --to must be a valid date (YYYY-MM-DD)");
        process.exit(1);
      }

      const fmt = opts.format as Format;
      if (!["table", "json", "csv"].includes(fmt)) {
        console.error("Error: --format must be table, json, or csv");
        process.exit(1);
      }

      let spec;
      try {
        spec = parseIndicatorSpec(specArg);
      } catch (e) {
        console.error(`Error: ${(e as Error).message}`);
        process.exit(1);
      }

      let env;
      try {
        env = readEnv();
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }

      if (needsFredKey(spec) && !env.fredApiKey) {
        console.error(
          "Error: FRED_API_KEY is required for treasury indicators",
        );
        process.exit(1);
      }

      const client = buildClient(env);

      try {
        const handle = buildIndicatorHandle(client, spec);

        const range = {
          ...(opts.from ? { from: opts.from } : {}),
          ...(opts.to ? { to: opts.to } : {}),
        };

        const bars = await handle.series(
          Object.keys(range).length > 0 ? range : undefined,
        );

        const output = formatBars(bars, fmt);
        if (output) {
          console.log(output);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });

  return cmd;
}
```

Also add the needed imports at the top of the file:

```typescript
import {
  parseIndicatorSpec,
  buildIndicatorHandle,
  needsFredKey,
} from "../lib/parse.js";
```

Remove the `validateArgs` function (lines 75-98) and the `getAllTypes` function (lines 117-123). Remove the `TREASURY_TYPES` set (lines 39-50) since `needsFredKey` from parse.ts replaces it.

- [ ] **Step 2: Rewrite indicator.test.ts**

Remove the `validateArgs` describe block. Keep `resolveType` and `parseTicker` tests unchanged. Remove the `validateArgs` import. The file becomes:

```typescript
import { describe, it, expect } from "vitest";
import {
  resolveType,
  parseTicker,
  TICKER_LOOKBACK_TYPES,
  TICKER_ONLY_TYPES,
  STANDALONE_TYPES,
} from "./indicator.js";

describe("resolveType", () => {
  it("maps lowercase to SDK enum value", () => {
    expect(resolveType("sma")).toBe("SMA");
    expect(resolveType("ema")).toBe("EMA");
    expect(resolveType("rsi")).toBe("RSI");
    expect(resolveType("price")).toBe("Price");
    expect(resolveType("return")).toBe("Return");
    expect(resolveType("volatility")).toBe("Volatility");
    expect(resolveType("drawdown")).toBe("Drawdown");
    expect(resolveType("vix")).toBe("VIX");
    expect(resolveType("vix3m")).toBe("VIX3M");
    expect(resolveType("t10y")).toBe("T10Y");
    expect(resolveType("t3m")).toBe("T3M");
  });

  it("is case-insensitive", () => {
    expect(resolveType("SMA")).toBe("SMA");
    expect(resolveType("Sma")).toBe("SMA");
    expect(resolveType("VIX3M")).toBe("VIX3M");
  });

  it("returns null for unknown types", () => {
    expect(resolveType("unknown")).toBeNull();
    expect(resolveType("threshold")).toBeNull();
    expect(resolveType("month")).toBeNull();
  });
});

describe("parseTicker", () => {
  it("returns symbol only when no params", () => {
    expect(parseTicker("SPY")).toEqual({ symbol: "SPY" });
  });

  it("parses leverage from ?L=N", () => {
    expect(parseTicker("SPY?L=3")).toEqual({ symbol: "SPY", leverage: 3 });
    expect(parseTicker("QQQ?L=2")).toEqual({ symbol: "QQQ", leverage: 2 });
  });

  it("ignores unknown params", () => {
    expect(parseTicker("SPY?foo=bar")).toEqual({ symbol: "SPY" });
  });

  it("throws on invalid leverage", () => {
    expect(() => parseTicker("SPY?L=0")).toThrow(/positive integer/);
    expect(() => parseTicker("SPY?L=-1")).toThrow(/positive integer/);
    expect(() => parseTicker("SPY?L=abc")).toThrow(/positive integer/);
    expect(() => parseTicker("SPY?L=1.5")).toThrow(/positive integer/);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/commands/indicator.test.ts`
Expected: PASS

- [ ] **Step 4: Run all CLI tests to check no regressions**

Run: `npx vitest run`
Expected: PASS — other tests should still work since indicator.ts exports are unchanged.

- [ ] **Step 5: Commit**

```bash
git -C cli add src/commands/indicator.ts src/commands/indicator.test.ts
git -C cli commit -m "refactor(cli): unify indicator command to use single spec string"
```

---

### Task 2: Rewrite signal command

**Files:**
- Modify: `cli/src/commands/signal.ts`
- Modify: `cli/src/commands/signal.test.ts`

- [ ] **Step 1: Rewrite signal.ts**

Replace the entire file. Remove `resolveComparison`, `validateSignalArgs`, `COMP_MAP`, and the multi-argument command. The new command takes a single `<spec>` string.

New `cli/src/commands/signal.ts`:

```typescript
import { Command } from "commander";
import type { DailyBar } from "@livefolio/sdk";
import { readEnv, buildClient } from "../lib/client.js";
import { formatTable, formatJson, formatCsv } from "../lib/format.js";
import {
  parseSignalSpec,
  buildSignalHandle,
  needsFredKey,
} from "../lib/parse.js";

function validateDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

type Format = "table" | "json" | "csv";

function formatBars(bars: DailyBar[], fmt: Format): string {
  switch (fmt) {
    case "table":
      return formatTable(bars);
    case "json":
      return formatJson(bars);
    case "csv":
      return formatCsv(bars);
  }
}

export function makeSignalCommand(): Command {
  const cmd = new Command("signal")
    .description("Evaluate a signal comparing two indicators")
    .argument("<spec>", 'signal spec (e.g. "Price SPY > SMA SPY 200 ~2")')
    .option("--from <date>", "start date (YYYY-MM-DD)")
    .option("--to <date>", "end date (YYYY-MM-DD)")
    .option("--format <fmt>", "output format: table, json, csv", "table")
    .option("--latest", "show only the latest value")
    .action(async (specArg: string, opts) => {
      if (opts.from && !validateDate(opts.from)) {
        console.error("Error: --from must be a valid date (YYYY-MM-DD)");
        process.exit(1);
      }
      if (opts.to && !validateDate(opts.to)) {
        console.error("Error: --to must be a valid date (YYYY-MM-DD)");
        process.exit(1);
      }

      const fmt = opts.format as Format;
      if (!["table", "json", "csv"].includes(fmt)) {
        console.error("Error: --format must be table, json, or csv");
        process.exit(1);
      }

      let spec;
      try {
        spec = parseSignalSpec(specArg);
      } catch (e) {
        console.error(`Error: ${(e as Error).message}`);
        process.exit(1);
      }

      let env;
      try {
        env = readEnv();
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }

      if (
        (needsFredKey(spec.indicator1) || needsFredKey(spec.indicator2)) &&
        !env.fredApiKey
      ) {
        console.error(
          "Error: FRED_API_KEY is required for treasury indicators",
        );
        process.exit(1);
      }

      const client = buildClient(env);

      try {
        const signalHandle = buildSignalHandle(client, spec, spec.tolerance);

        if (opts.latest) {
          const val = await signalHandle.value();
          console.log(val === null ? "null" : String(val));
          return;
        }

        const range = {
          ...(opts.from ? { from: opts.from } : {}),
          ...(opts.to ? { to: opts.to } : {}),
        };

        const bars = await signalHandle.series(
          Object.keys(range).length > 0 ? range : undefined,
        );

        const output = formatBars(bars, fmt);
        if (output) {
          console.log(output);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });

  return cmd;
}
```

- [ ] **Step 2: Rewrite signal.test.ts**

Remove `resolveComparison` and `validateSignalArgs` imports and test blocks. Keep the `parseIndicatorSpec` tests (they test parse.ts and are still valid). The file becomes:

```typescript
import { describe, it, expect } from "vitest";
import { parseIndicatorSpec } from "../lib/parse.js";

describe("parseIndicatorSpec", () => {
  it("parses standalone types", () => {
    expect(parseIndicatorSpec("vix")).toEqual({ type: "VIX" });
    expect(parseIndicatorSpec("vix3m")).toEqual({ type: "VIX3M" });
    expect(parseIndicatorSpec("t10y")).toEqual({ type: "T10Y" });
  });

  it("parses ticker-only types", () => {
    expect(parseIndicatorSpec("price SPY")).toEqual({
      type: "Price",
      ticker: "SPY",
    });
  });

  it("parses ticker+lookback types", () => {
    expect(parseIndicatorSpec("sma SPY 200")).toEqual({
      type: "SMA",
      ticker: "SPY",
      lookback: 200,
    });
    expect(parseIndicatorSpec("rsi QQQ 14")).toEqual({
      type: "RSI",
      ticker: "QQQ",
      lookback: 14,
    });
  });

  it("parses ticker with leverage", () => {
    expect(parseIndicatorSpec("price SPY?L=3")).toEqual({
      type: "Price",
      ticker: "SPY",
      leverage: 3,
    });
    expect(parseIndicatorSpec("sma SPY?L=2 50")).toEqual({
      type: "SMA",
      ticker: "SPY",
      leverage: 2,
      lookback: 50,
    });
  });

  it("is case-insensitive for type", () => {
    expect(parseIndicatorSpec("SMA SPY 200")).toEqual({
      type: "SMA",
      ticker: "SPY",
      lookback: 200,
    });
    expect(parseIndicatorSpec("VIX")).toEqual({ type: "VIX" });
  });

  it("parses threshold type", () => {
    expect(parseIndicatorSpec("threshold 30")).toEqual({
      type: "Threshold",
      value: 30,
    });
    expect(parseIndicatorSpec("threshold 0.5")).toEqual({
      type: "Threshold",
      value: 0.5,
    });
  });

  it("throws on unknown type", () => {
    expect(() => parseIndicatorSpec("unknown SPY")).toThrow(
      /unknown indicator type/i,
    );
  });

  it("throws when ticker-only type missing ticker", () => {
    expect(() => parseIndicatorSpec("price")).toThrow(/requires.*ticker/i);
  });

  it("throws when ticker+lookback type missing args", () => {
    expect(() => parseIndicatorSpec("sma SPY")).toThrow(/requires.*lookback/i);
    expect(() => parseIndicatorSpec("sma")).toThrow(/requires.*ticker/i);
  });

  it("throws on invalid lookback", () => {
    expect(() => parseIndicatorSpec("sma SPY abc")).toThrow(
      /positive integer/i,
    );
    expect(() => parseIndicatorSpec("sma SPY 0")).toThrow(/positive integer/i);
    expect(() => parseIndicatorSpec("sma SPY -5")).toThrow(/positive integer/i);
  });

  it("throws on invalid threshold value", () => {
    expect(() => parseIndicatorSpec("threshold")).toThrow(/requires.*value/i);
    expect(() => parseIndicatorSpec("threshold abc")).toThrow(
      /must be a number/i,
    );
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/commands/signal.test.ts`
Expected: PASS

- [ ] **Step 4: Run all CLI tests**

Run: `npx vitest run`
Expected: PASS — 5 test files, all passing. Total test count will decrease since we removed `validateArgs`, `resolveComparison`, and `validateSignalArgs` test blocks.

- [ ] **Step 5: Commit**

```bash
git -C cli add src/commands/signal.ts src/commands/signal.test.ts
git -C cli commit -m "refactor(cli): unify signal command to use single spec string"
```
