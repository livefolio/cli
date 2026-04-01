# Strategy CLI Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `strategy` command to the livefolio CLI with `post`, `run`, and `get` subcommands for creating, simulating, and inspecting strategies.

**Architecture:** Extract shared parsing from `signal.ts` into `cli/src/lib/parse.ts`. Build `strategy.ts` command with three subcommands using Commander.js. Reuse existing SDK handles (`StrategyHandle`, `SimulationHandle`, `PortfolioHandle`).

**Tech Stack:** TypeScript, Commander.js, Vitest, @livefolio/sdk

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `cli/src/lib/parse.ts` | Create | Shared indicator spec parsing, signal string parsing, handle building |
| `cli/src/lib/parse.test.ts` | Create | Tests for shared parsing module |
| `cli/src/commands/signal.ts` | Modify | Remove duplicated parsing, import from `lib/parse.ts` |
| `cli/src/commands/signal.test.ts` | Modify | Update imports to point at `lib/parse.ts` |
| `cli/src/commands/strategy.ts` | Create | Strategy command with post/run/get subcommands |
| `cli/src/commands/strategy.test.ts` | Create | Tests for strategy JSON validation and parsing |
| `cli/src/index.ts` | Modify | Register strategy command |

---

### Task 1: Extract shared parsing into `cli/src/lib/parse.ts`

**Files:**
- Create: `cli/src/lib/parse.ts`
- Create: `cli/src/lib/parse.test.ts`
- Modify: `cli/src/commands/signal.ts`
- Modify: `cli/src/commands/signal.test.ts`

- [ ] **Step 1: Create `cli/src/lib/parse.ts` with functions extracted from signal.ts**

```typescript
import {
  resolveType,
  parseTicker,
  TICKER_LOOKBACK_TYPES,
  TICKER_ONLY_TYPES,
  STANDALONE_TYPES,
} from "../commands/indicator.js";
import type { LivefolioClient } from "@livefolio/sdk";

// --- Threshold handling ---

const THRESHOLD_TYPE = "Threshold";

function isThresholdType(input: string): boolean {
  return input.toLowerCase() === "threshold";
}

// --- Exported types ---

export interface IndicatorSpec {
  type: string;
  ticker?: string;
  leverage?: number;
  lookback?: number;
  value?: number;
}

type Comparison = ">" | "<" | "=";

export interface SignalSpec {
  indicator1: IndicatorSpec;
  indicator2: IndicatorSpec;
  comparison: Comparison;
}

// --- Indicator spec parsing ---

export function parseIndicatorSpec(input: string): IndicatorSpec {
  const parts = input.trim().split(/\s+/);
  const rawType = parts[0];

  if (isThresholdType(rawType)) {
    if (parts.length < 2) {
      throw new Error("Threshold requires a <value>");
    }
    const v = Number(parts[1]);
    if (isNaN(v)) {
      throw new Error(`Threshold value must be a number, got "${parts[1]}"`);
    }
    return { type: THRESHOLD_TYPE, value: v };
  }

  const type = resolveType(rawType);
  if (!type) {
    const allTypes = [
      ...TICKER_LOOKBACK_TYPES,
      ...TICKER_ONLY_TYPES,
      ...STANDALONE_TYPES,
    ].map((t) => t.toLowerCase());
    throw new Error(
      `Unknown indicator type "${rawType}". Available: ${allTypes.join(", ")}`,
    );
  }

  const tlSet = new Set<string>(TICKER_LOOKBACK_TYPES);
  const toSet = new Set<string>(TICKER_ONLY_TYPES);

  if (tlSet.has(type)) {
    if (parts.length < 2) {
      throw new Error(`${type.toLowerCase()} requires <ticker> and <lookback>`);
    }
    if (parts.length < 3) {
      throw new Error(`${type.toLowerCase()} requires <ticker> and <lookback>`);
    }
    const parsed = parseTicker(parts[1]);
    const lb = Number(parts[2]);
    if (!Number.isInteger(lb) || lb <= 0) {
      throw new Error("Lookback must be a positive integer");
    }
    return {
      type,
      ticker: parsed.symbol,
      leverage: parsed.leverage,
      lookback: lb,
    };
  }

  if (toSet.has(type)) {
    if (parts.length < 2) {
      throw new Error(`${type.toLowerCase()} requires <ticker>`);
    }
    const parsed = parseTicker(parts[1]);
    return { type, ticker: parsed.symbol, leverage: parsed.leverage };
  }

  return { type };
}

// --- Signal string parsing ---

const OPERATOR_RE = / ([><=]) /;

export function parseSignalSpec(input: string): SignalSpec {
  const match = input.match(OPERATOR_RE);
  if (!match || match.index === undefined) {
    throw new Error(
      `Invalid signal spec "${input}". Expected format: "<indicator> > <indicator>"`,
    );
  }

  const comparison = match[1] as Comparison;
  const ind1Str = input.slice(0, match.index).trim();
  const ind2Str = input.slice(match.index + match[0].length).trim();

  if (!ind1Str) {
    throw new Error("Missing indicator before operator");
  }
  if (!ind2Str) {
    throw new Error("Missing indicator after operator");
  }

  return {
    indicator1: parseIndicatorSpec(ind1Str),
    indicator2: parseIndicatorSpec(ind2Str),
    comparison,
  };
}

// --- Handle building ---

const TREASURY_TYPES = new Set([
  "T3M",
  "T6M",
  "T1Y",
  "T2Y",
  "T3Y",
  "T5Y",
  "T7Y",
  "T10Y",
  "T20Y",
  "T30Y",
]);

export function needsFredKey(spec: IndicatorSpec): boolean {
  return TREASURY_TYPES.has(spec.type);
}

export function buildIndicatorHandle(
  client: LivefolioClient,
  spec: IndicatorSpec,
) {
  const tlSet = new Set<string>(TICKER_LOOKBACK_TYPES);
  const toSet = new Set<string>(TICKER_ONLY_TYPES);

  if (spec.type === THRESHOLD_TYPE) {
    return client.threshold(spec.value!);
  }

  if (tlSet.has(spec.type)) {
    const t = client.ticker(spec.ticker!, spec.leverage);
    const lb = spec.lookback!;
    if (spec.type === "Return") {
      return client.returns(t, lb);
    }
    const method = spec.type.toLowerCase() as
      | "sma"
      | "ema"
      | "rsi"
      | "volatility"
      | "drawdown";
    return client[method](t, lb);
  }

  if (toSet.has(spec.type)) {
    return client.price(client.ticker(spec.ticker!, spec.leverage));
  }

  if (spec.type === "VIX") return client.vix();
  if (spec.type === "VIX3M") return client.vix3m();

  return client.treasury(spec.type as Parameters<typeof client.treasury>[0]);
}

export function buildSignalHandle(
  client: LivefolioClient,
  spec: SignalSpec,
  tolerance: number = 0,
) {
  const handle1 = buildIndicatorHandle(client, spec.indicator1);
  const handle2 = buildIndicatorHandle(client, spec.indicator2);

  if (spec.comparison === ">") {
    return client.gt(handle1, handle2, tolerance);
  } else if (spec.comparison === "<") {
    return client.lt(handle1, handle2, tolerance);
  } else {
    return client.eq(handle1, handle2, tolerance);
  }
}
```

- [ ] **Step 2: Create `cli/src/lib/parse.test.ts` with tests for new `parseSignalSpec` function**

The existing `parseIndicatorSpec` tests stay in `signal.test.ts` for now (moved in step 5). Add tests for the new `parseSignalSpec`:

```typescript
import { describe, it, expect } from "vitest";
import { parseSignalSpec } from "./parse.js";

describe("parseSignalSpec", () => {
  it("parses greater-than signal", () => {
    expect(parseSignalSpec("SMA SPY 50 > SMA SPY 200")).toEqual({
      indicator1: { type: "SMA", ticker: "SPY", lookback: 50 },
      indicator2: { type: "SMA", ticker: "SPY", lookback: 200 },
      comparison: ">",
    });
  });

  it("parses less-than signal", () => {
    expect(parseSignalSpec("RSI SPY 14 < Threshold 30")).toEqual({
      indicator1: { type: "RSI", ticker: "SPY", lookback: 14 },
      indicator2: { type: "Threshold", value: 30 },
      comparison: "<",
    });
  });

  it("parses equals signal", () => {
    expect(parseSignalSpec("VIX = Threshold 20")).toEqual({
      indicator1: { type: "VIX" },
      indicator2: { type: "Threshold", value: 20 },
      comparison: "=",
    });
  });

  it("parses standalone indicators", () => {
    expect(parseSignalSpec("VIX > VIX3M")).toEqual({
      indicator1: { type: "VIX" },
      indicator2: { type: "VIX3M" },
      comparison: ">",
    });
  });

  it("parses ticker with leverage", () => {
    expect(parseSignalSpec("Price SPY?L=3 > SMA SPY?L=3 200")).toEqual({
      indicator1: { type: "Price", ticker: "SPY", leverage: 3 },
      indicator2: { type: "SMA", ticker: "SPY", leverage: 3, lookback: 200 },
      comparison: ">",
    });
  });

  it("throws on missing operator", () => {
    expect(() => parseSignalSpec("SMA SPY 50 SMA SPY 200")).toThrow(
      /invalid signal spec/i,
    );
  });

  it("throws on missing indicator before operator", () => {
    expect(() => parseSignalSpec("> SMA SPY 200")).toThrow(
      /missing indicator before/i,
    );
  });

  it("throws on missing indicator after operator", () => {
    expect(() => parseSignalSpec("SMA SPY 50 >")).toThrow(
      /missing indicator after/i,
    );
  });

  it("throws on invalid indicator in signal", () => {
    expect(() => parseSignalSpec("unknown SPY > SMA SPY 200")).toThrow(
      /unknown indicator type/i,
    );
  });
});
```

- [ ] **Step 3: Run new tests to verify they pass**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx vitest run src/lib/parse.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 4: Update `signal.ts` to import from `lib/parse.ts`**

Replace the duplicated code in `cli/src/commands/signal.ts`. Remove:
- `IndicatorSpec` interface
- `parseIndicatorSpec` function
- `isThresholdType` function
- `THRESHOLD_TYPE` constant
- `ALL_TYPES` constant
- `Comparison` type
- `COMP_MAP` and `resolveComparison` function
- `TREASURY_TYPES` set and `needsFredKey` function
- `buildHandle` function

Replace the top of `signal.ts` with:

```typescript
import { Command } from "commander";
import type { DailyBar } from "@livefolio/sdk";
import { readEnv, buildClient } from "../lib/client.js";
import { formatTable, formatJson, formatCsv } from "../lib/format.js";
import {
  parseIndicatorSpec,
  buildIndicatorHandle,
  needsFredKey,
  type IndicatorSpec,
} from "../lib/parse.js";

// --- Comparison validation (kept here for signal CLI arg parsing) ---

type Comparison = ">" | "<" | "=";

const COMP_MAP: Record<string, Comparison> = {
  gt: ">",
  lt: "<",
  eq: "=",
};

export function resolveComparison(input: string): Comparison | null {
  return COMP_MAP[input.toLowerCase()] ?? null;
}

export function validateSignalArgs(
  compArg: string,
  ind1Arg: string,
  ind2Arg: string,
  opts?: { tolerance?: string },
): string | null {
  const comp = resolveComparison(compArg);
  if (!comp) {
    return `Error: unknown comparison "${compArg}". Use gt, lt, or eq`;
  }

  try {
    parseIndicatorSpec(ind1Arg);
  } catch (e) {
    return `Error in indicator 1: ${(e as Error).message}`;
  }

  try {
    parseIndicatorSpec(ind2Arg);
  } catch (e) {
    return `Error in indicator 2: ${(e as Error).message}`;
  }

  if (opts?.tolerance !== undefined) {
    const t = Number(opts.tolerance);
    if (isNaN(t)) {
      return "Error: tolerance must be a number";
    }
    if (t < 0) {
      return "Error: tolerance must be non-negative";
    }
  }

  return null;
}
```

In the `makeSignalCommand` action handler, replace `buildHandle(client, spec1)` calls with `buildIndicatorHandle(client, spec1)`.

Specifically, replace:

```typescript
        const handle1 = buildHandle(client, spec1);
        const handle2 = buildHandle(client, spec2);
```

with:

```typescript
        const handle1 = buildIndicatorHandle(client, spec1);
        const handle2 = buildIndicatorHandle(client, spec2);
```

- [ ] **Step 5: Update `signal.test.ts` imports**

Replace the import line at the top of `cli/src/commands/signal.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseIndicatorSpec } from "../lib/parse.js";
import { resolveComparison, validateSignalArgs } from "./signal.js";
```

- [ ] **Step 6: Run all existing tests to verify refactor is clean**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx vitest run`
Expected: All tests PASS (signal.test.ts, parse.test.ts, indicator.test.ts, format.test.ts)

- [ ] **Step 7: Commit**

```bash
cd /Users/raksi/Documents/Personal/livefolio-2/cli
git add src/lib/parse.ts src/lib/parse.test.ts src/commands/signal.ts src/commands/signal.test.ts
git commit -m "refactor: extract shared parsing into lib/parse.ts"
```

---

### Task 2: Strategy JSON validation and parsing

**Files:**
- Create: `cli/src/commands/strategy.test.ts`
- Create: `cli/src/commands/strategy.ts` (validation only)

- [ ] **Step 1: Write failing tests for strategy JSON validation in `cli/src/commands/strategy.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { parseStrategyJson } from "./strategy.js";

describe("parseStrategyJson", () => {
  it("parses a valid strategy with all fields", () => {
    const input = JSON.stringify({
      name: "Golden Cross",
      freq: "Monthly",
      offset: 1,
      rules: [
        {
          when: ["SMA SPY 50 > SMA SPY 200"],
          hold: { SPY: 0.6, CASHX: 0.4 },
        },
        { hold: { CASHX: 1 } },
      ],
    });
    const result = parseStrategyJson(input);
    expect(result.name).toBe("Golden Cross");
    expect(result.freq).toBe("Monthly");
    expect(result.offset).toBe(1);
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0].signals).toHaveLength(1);
    expect(result.rules[0].signals[0]).toEqual({
      indicator1: { type: "SMA", ticker: "SPY", lookback: 50 },
      indicator2: { type: "SMA", ticker: "SPY", lookback: 200 },
      comparison: ">",
    });
    expect(result.rules[0].hold).toEqual({ SPY: 0.6, CASHX: 0.4 });
    expect(result.rules[1].signals).toEqual([]);
    expect(result.rules[1].hold).toEqual({ CASHX: 1 });
  });

  it("applies defaults for freq and offset", () => {
    const input = JSON.stringify({
      name: "Simple",
      rules: [{ hold: { CASHX: 1 } }],
    });
    const result = parseStrategyJson(input);
    expect(result.freq).toBe("Daily");
    expect(result.offset).toBe(0);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseStrategyJson("not json")).toThrow(/invalid json/i);
  });

  it("throws on missing name", () => {
    const input = JSON.stringify({ rules: [{ hold: { CASHX: 1 } }] });
    expect(() => parseStrategyJson(input)).toThrow(/name.*required/i);
  });

  it("throws on missing rules", () => {
    const input = JSON.stringify({ name: "Test" });
    expect(() => parseStrategyJson(input)).toThrow(/rules.*required/i);
  });

  it("throws on empty rules array", () => {
    const input = JSON.stringify({ name: "Test", rules: [] });
    expect(() => parseStrategyJson(input)).toThrow(/at least one rule/i);
  });

  it("throws when last rule has when clause", () => {
    const input = JSON.stringify({
      name: "Test",
      rules: [{ when: ["VIX > Threshold 20"], hold: { CASHX: 1 } }],
    });
    expect(() => parseStrategyJson(input)).toThrow(/last rule.*fallback/i);
  });

  it("throws when non-last rule has no when clause", () => {
    const input = JSON.stringify({
      name: "Test",
      rules: [{ hold: { SPY: 1 } }, { hold: { CASHX: 1 } }],
    });
    expect(() => parseStrategyJson(input)).toThrow(
      /non-fallback.*must have.*when/i,
    );
  });

  it("throws on missing hold", () => {
    const input = JSON.stringify({
      name: "Test",
      rules: [{ when: ["VIX > Threshold 20"] }],
    });
    expect(() => parseStrategyJson(input)).toThrow(/hold.*required/i);
  });

  it("throws on invalid freq", () => {
    const input = JSON.stringify({
      name: "Test",
      freq: "Biweekly",
      rules: [{ hold: { CASHX: 1 } }],
    });
    expect(() => parseStrategyJson(input)).toThrow(/freq/i);
  });

  it("throws on invalid signal spec in when", () => {
    const input = JSON.stringify({
      name: "Test",
      rules: [
        { when: ["bad signal string"], hold: { SPY: 1 } },
        { hold: { CASHX: 1 } },
      ],
    });
    expect(() => parseStrategyJson(input)).toThrow(/invalid signal spec/i);
  });

  it("parses hold with leveraged ticker", () => {
    const input = JSON.stringify({
      name: "Leveraged",
      rules: [{ hold: { "SPY?L=3": 0.5, CASHX: 0.5 } }],
    });
    const result = parseStrategyJson(input);
    expect(result.rules[0].hold).toEqual({ "SPY?L=3": 0.5, CASHX: 0.5 });
  });

  it("parses multiple signals in when array", () => {
    const input = JSON.stringify({
      name: "Multi",
      rules: [
        {
          when: ["SMA SPY 50 > SMA SPY 200", "RSI SPY 14 < Threshold 70"],
          hold: { SPY: 1 },
        },
        { hold: { CASHX: 1 } },
      ],
    });
    const result = parseStrategyJson(input);
    expect(result.rules[0].signals).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx vitest run src/commands/strategy.test.ts`
Expected: FAIL — `parseStrategyJson` not found

- [ ] **Step 3: Implement `parseStrategyJson` in `cli/src/commands/strategy.ts`**

```typescript
import { Command } from "commander";
import { readEnv, buildClient } from "../lib/client.js";
import {
  parseIndicatorSpec,
  parseSignalSpec,
  buildIndicatorHandle,
  buildSignalHandle,
  needsFredKey,
  type IndicatorSpec,
  type SignalSpec,
} from "../lib/parse.js";
import { parseTicker } from "./indicator.js";
import type { LivefolioClient } from "@livefolio/sdk";

// --- Types ---

interface ParsedRule {
  signals: SignalSpec[];
  hold: Record<string, number>;
}

interface ParsedStrategy {
  name: string;
  freq: string;
  offset: number;
  rules: ParsedRule[];
}

const VALID_FREQS = new Set([
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Yearly",
]);

// --- JSON parsing ---

export function parseStrategyJson(input: string): ParsedStrategy {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error("Invalid JSON: could not parse input");
  }

  const obj = raw as Record<string, unknown>;

  if (!obj.name || typeof obj.name !== "string") {
    throw new Error("name is required and must be a string");
  }

  const freq = (obj.freq as string) ?? "Daily";
  if (!VALID_FREQS.has(freq)) {
    throw new Error(
      `Invalid freq "${freq}". Must be one of: ${[...VALID_FREQS].join(", ")}`,
    );
  }

  const offset = (obj.offset as number) ?? 0;

  if (!Array.isArray(obj.rules)) {
    throw new Error("rules is required and must be an array");
  }
  if (obj.rules.length === 0) {
    throw new Error("rules must contain at least one rule");
  }

  const rules: ParsedRule[] = [];

  for (let i = 0; i < obj.rules.length; i++) {
    const rule = obj.rules[i] as Record<string, unknown>;
    const isLast = i === obj.rules.length - 1;
    const hasWhen = rule.when !== undefined;

    if (isLast && hasWhen) {
      throw new Error("Last rule must be a fallback (no when clause)");
    }
    if (!isLast && !hasWhen) {
      throw new Error(`Non-fallback rule ${i + 1} must have a when clause`);
    }

    if (!rule.hold || typeof rule.hold !== "object") {
      throw new Error(`Rule ${i + 1}: hold is required`);
    }

    const signals: SignalSpec[] = [];
    if (hasWhen) {
      const whenArr = rule.when as string[];
      for (const spec of whenArr) {
        signals.push(parseSignalSpec(spec));
      }
    }

    rules.push({
      signals,
      hold: rule.hold as Record<string, number>,
    });
  }

  return { name: obj.name, freq, offset, rules };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx vitest run src/commands/strategy.test.ts`
Expected: All 13 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/raksi/Documents/Personal/livefolio-2/cli
git add src/commands/strategy.ts src/commands/strategy.test.ts
git commit -m "feat: add strategy JSON validation and parsing"
```

---

### Task 3: Implement `post` subcommand

**Files:**
- Modify: `cli/src/commands/strategy.ts`

- [ ] **Step 1: Add `buildStrategyHandles` function and `makePostCommand` to `strategy.ts`**

Append below `parseStrategyJson`:

```typescript
function buildStrategyHandles(client: LivefolioClient, parsed: ParsedStrategy) {
  const rules = parsed.rules.map((rule) => {
    const when = rule.signals.map((sig) => buildSignalHandle(client, sig));

    const holdPairs = Object.entries(rule.hold).map(
      ([sym, weight]) => {
        const { symbol, leverage } = parseTicker(sym);
        return [client.ticker(symbol, leverage), weight] as [
          ReturnType<LivefolioClient["ticker"]>,
          number,
        ];
      },
    );
    const hold = client.allocation(...holdPairs);

    return when.length > 0 ? { when, hold } : { hold };
  });

  return client.strategy({
    name: parsed.name,
    freq: parsed.freq as "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Yearly",
    offset: parsed.offset,
    rules,
  });
}

function makePostCommand(): Command {
  return new Command("post")
    .description("Create a strategy from JSON and print its link_id")
    .argument("<json>", "strategy definition as simplified JSON")
    .action(async (jsonArg: string) => {
      let parsed: ParsedStrategy;
      try {
        parsed = parseStrategyJson(jsonArg);
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

      // Check FRED key for treasury indicators in signals
      for (const rule of parsed.rules) {
        for (const sig of rule.signals) {
          if (needsFredKey(sig.indicator1) || needsFredKey(sig.indicator2)) {
            if (!env.fredApiKey) {
              console.error(
                "Error: FRED_API_KEY is required for treasury indicators",
              );
              process.exit(1);
            }
          }
        }
      }

      const client = buildClient(env);

      try {
        const strategy = buildStrategyHandles(client, parsed);
        const row = await strategy.resolve();
        console.log(row.link_id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 2: Add `makeStrategyCommand` export at the bottom of `strategy.ts`**

```typescript
export function makeStrategyCommand(): Command {
  const cmd = new Command("strategy").description(
    "Create, simulate, and inspect strategies",
  );
  cmd.addCommand(makePostCommand());
  return cmd;
}
```

- [ ] **Step 3: Register in `cli/src/index.ts`**

Add import and registration:

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { makeIndicatorCommand } from "./commands/indicator.js";
import { makeSignalCommand } from "./commands/signal.js";
import { makeStrategyCommand } from "./commands/strategy.js";

const program = new Command();

program.name("livefolio").description("Livefolio CLI").version("0.0.1");

program.addCommand(makeIndicatorCommand());
program.addCommand(makeSignalCommand());
program.addCommand(makeStrategyCommand());

program.parseAsync();
```

- [ ] **Step 4: Build and verify compilation**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Run all tests**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/raksi/Documents/Personal/livefolio-2/cli
git add src/commands/strategy.ts src/index.ts
git commit -m "feat: add strategy post subcommand"
```

---

### Task 4: Implement `run` subcommand

**Files:**
- Modify: `cli/src/commands/strategy.ts`

- [ ] **Step 1: Add `validateDate` helper and `makeRunCommand` to `strategy.ts`**

Add above `makeStrategyCommand`:

```typescript
function validateDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

function makeRunCommand(): Command {
  return new Command("run")
    .description("Simulate a strategy and print results as JSON")
    .argument("<link_id>", "strategy link_id")
    .option("--from <date>", "start date (YYYY-MM-DD)")
    .option("--to <date>", "end date (YYYY-MM-DD)")
    .requiredOption("--capital <number>", "initial capital in dollars")
    .action(async (linkId: string, opts) => {
      if (opts.from && !validateDate(opts.from)) {
        console.error("Error: --from must be a valid date (YYYY-MM-DD)");
        process.exit(1);
      }
      if (opts.to && !validateDate(opts.to)) {
        console.error("Error: --to must be a valid date (YYYY-MM-DD)");
        process.exit(1);
      }

      const capital = Number(opts.capital);
      if (isNaN(capital) || capital <= 0) {
        console.error("Error: --capital must be a positive number");
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

        let from = opts.from;
        let to = opts.to;

        if (!from || !to) {
          const bars = await strategy.series();
          if (bars.length === 0) {
            console.error("Error: strategy has no data");
            process.exit(1);
          }
          if (!from) from = bars[0].date;
          if (!to) to = bars[bars.length - 1].date;
        }

        const portfolio = client.portfolio([client.ticker("CASHX"), capital]);
        const sim = await strategy.simulate({ from, to, portfolio });

        console.log(
          JSON.stringify({ series: sim.series, trades: sim.trades }, null, 2),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 2: Register `run` in `makeStrategyCommand`**

Update `makeStrategyCommand`:

```typescript
export function makeStrategyCommand(): Command {
  const cmd = new Command("strategy").description(
    "Create, simulate, and inspect strategies",
  );
  cmd.addCommand(makePostCommand());
  cmd.addCommand(makeRunCommand());
  return cmd;
}
```

- [ ] **Step 3: Build and verify compilation**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /Users/raksi/Documents/Personal/livefolio-2/cli
git add src/commands/strategy.ts
git commit -m "feat: add strategy run subcommand"
```

---

### Task 5: Implement `get` subcommand

**Files:**
- Modify: `cli/src/commands/strategy.ts`

- [ ] **Step 1: Add `makeGetCommand` to `strategy.ts`**

Add above `makeStrategyCommand`:

```typescript
function makeGetCommand(): Command {
  return new Command("get")
    .description("Show a strategy definition as JSON")
    .argument("<link_id>", "strategy link_id")
    .action(async (linkId: string) => {
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
        const row = await strategy.resolve();
        console.log(JSON.stringify(row, null, 2));
      } catch (e) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 2: Register `get` in `makeStrategyCommand`**

Update `makeStrategyCommand`:

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

- [ ] **Step 3: Build and verify compilation**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run full test suite**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/raksi/Documents/Personal/livefolio-2/cli
git add src/commands/strategy.ts
git commit -m "feat: add strategy get subcommand"
```

