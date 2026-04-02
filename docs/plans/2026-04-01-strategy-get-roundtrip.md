# Strategy Get Round-Trip Output — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `strategy get` output post-compatible JSON so the output can be piped back into `strategy post`.

**Architecture:** Add serialization functions in the CLI layer (inverse of the parse functions in `parse.ts`) that walk the hydrated SDK handle tree and reconstruct spec strings. Change `makeGetCommand` to use them instead of dumping the raw DB row.

**Tech Stack:** TypeScript, Vitest, @livefolio/sdk handle types

---

### Task 1: Add `serializeTickerSpec` with tests

**Files:**
- Modify: `cli/src/commands/strategy.ts` — add `serializeTickerSpec` function
- Modify: `cli/src/commands/strategy.test.ts` — add tests

- [ ] **Step 1: Write the failing tests**

Add to `cli/src/commands/strategy.test.ts`:

```ts
import {
  parseStrategyJson,
  formatHoldings,
  filterChangesOnly,
  serializeTickerSpec,
} from "./strategy.js";

describe("serializeTickerSpec", () => {
  it("returns plain symbol when leverage is 1", () => {
    expect(serializeTickerSpec("SPY", 1)).toBe("SPY");
  });

  it("appends ?L=N when leverage is not 1", () => {
    expect(serializeTickerSpec("QQQ", 3)).toBe("QQQ?L=3");
  });

  it("appends ?L=N for leverage 2", () => {
    expect(serializeTickerSpec("GLD", 2)).toBe("GLD?L=2");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --reporter verbose 2>&1 | head -30`
Expected: FAIL — `serializeTickerSpec` is not exported

- [ ] **Step 3: Write minimal implementation**

Add to `cli/src/commands/strategy.ts` and export it:

```ts
export function serializeTickerSpec(symbol: string, leverage: number): string {
  return leverage !== 1 ? `${symbol}?L=${leverage}` : symbol;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --reporter verbose 2>&1 | tail -20`
Expected: All `serializeTickerSpec` tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/strategy.ts src/commands/strategy.test.ts
git commit -m "feat(cli): add serializeTickerSpec for round-trip output"
```

---

### Task 2: Add `serializeIndicatorSpec` with tests

**Files:**
- Modify: `cli/src/commands/strategy.ts` — add `serializeIndicatorSpec` function
- Modify: `cli/src/commands/strategy.test.ts` — add tests

- [ ] **Step 1: Write the failing tests**

Add to `cli/src/commands/strategy.test.ts`:

```ts
import {
  parseStrategyJson,
  formatHoldings,
  filterChangesOnly,
  serializeTickerSpec,
  serializeIndicatorSpec,
} from "./strategy.js";

describe("serializeIndicatorSpec", () => {
  it("serializes ticker+lookback type", () => {
    expect(
      serializeIndicatorSpec({ type: "SMA", ticker: "SPY", lookback: 200, delay: 0, leverage: 1 }),
    ).toBe("SMA SPY 200");
  });

  it("serializes ticker+lookback with leverage", () => {
    expect(
      serializeIndicatorSpec({ type: "RSI", ticker: "QQQ", lookback: 10, delay: 0, leverage: 3 }),
    ).toBe("RSI QQQ?L=3 10");
  });

  it("serializes ticker-only type (Price)", () => {
    expect(
      serializeIndicatorSpec({ type: "Price", ticker: "SPY", lookback: 0, delay: 0, leverage: 1 }),
    ).toBe("Price SPY");
  });

  it("serializes standalone type (VIX)", () => {
    expect(
      serializeIndicatorSpec({ type: "VIX", ticker: null, lookback: 0, delay: 0, leverage: 1 }),
    ).toBe("VIX");
  });

  it("serializes standalone type (T10Y)", () => {
    expect(
      serializeIndicatorSpec({ type: "T10Y", ticker: null, lookback: 0, delay: 0, leverage: 1 }),
    ).toBe("T10Y");
  });

  it("serializes Threshold type", () => {
    expect(
      serializeIndicatorSpec({ type: "Threshold", ticker: null, lookback: 0, delay: 0, leverage: 1, threshold: 80 }),
    ).toBe("Threshold 80");
  });

  it("serializes Threshold with decimal value", () => {
    expect(
      serializeIndicatorSpec({ type: "Threshold", ticker: null, lookback: 0, delay: 0, leverage: 1, threshold: 0.5 }),
    ).toBe("Threshold 0.5");
  });

  it("appends delay when non-zero", () => {
    expect(
      serializeIndicatorSpec({ type: "Price", ticker: "SPY", lookback: 0, delay: 1, leverage: 1 }),
    ).toBe("Price SPY @1");
  });

  it("appends negative delay", () => {
    expect(
      serializeIndicatorSpec({ type: "SMA", ticker: "SPY", lookback: 200, delay: -3, leverage: 1 }),
    ).toBe("SMA SPY 200 @-3");
  });

  it("omits delay when zero", () => {
    expect(
      serializeIndicatorSpec({ type: "VIX", ticker: null, lookback: 0, delay: 0, leverage: 1 }),
    ).toBe("VIX");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --reporter verbose 2>&1 | head -30`
Expected: FAIL — `serializeIndicatorSpec` is not exported

- [ ] **Step 3: Write minimal implementation**

Add to `cli/src/commands/strategy.ts`:

```ts
import {
  TICKER_LOOKBACK_TYPES,
  TICKER_ONLY_TYPES,
} from "./indicator.js";

interface SerializableIndicator {
  type: string;
  ticker: string | null;
  lookback: number;
  delay: number;
  leverage: number;
  threshold?: number | null;
}

const TICKER_LOOKBACK_SET = new Set<string>(TICKER_LOOKBACK_TYPES);
const TICKER_ONLY_SET = new Set<string>(TICKER_ONLY_TYPES);

export function serializeIndicatorSpec(ind: SerializableIndicator): string {
  const parts: string[] = [];

  if (ind.type === "Threshold") {
    parts.push("Threshold", String(ind.threshold));
  } else if (TICKER_LOOKBACK_SET.has(ind.type)) {
    parts.push(ind.type, serializeTickerSpec(ind.ticker!, ind.leverage), String(ind.lookback));
  } else if (TICKER_ONLY_SET.has(ind.type)) {
    parts.push(ind.type, serializeTickerSpec(ind.ticker!, ind.leverage));
  } else {
    // Standalone (VIX, VIX3M, treasury)
    parts.push(ind.type);
  }

  if (ind.delay !== 0) {
    parts.push(`@${ind.delay}`);
  }

  return parts.join(" ");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --reporter verbose 2>&1 | tail -20`
Expected: All `serializeIndicatorSpec` tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/strategy.ts src/commands/strategy.test.ts
git commit -m "feat(cli): add serializeIndicatorSpec for round-trip output"
```

---

### Task 3: Add `serializeSignalSpec` with tests

**Files:**
- Modify: `cli/src/commands/strategy.ts` — add `serializeSignalSpec` function
- Modify: `cli/src/commands/strategy.test.ts` — add tests

- [ ] **Step 1: Write the failing tests**

Add to `cli/src/commands/strategy.test.ts`:

```ts
import {
  parseStrategyJson,
  formatHoldings,
  filterChangesOnly,
  serializeTickerSpec,
  serializeIndicatorSpec,
  serializeSignalSpec,
} from "./strategy.js";

describe("serializeSignalSpec", () => {
  it("serializes basic signal with tolerance", () => {
    expect(
      serializeSignalSpec(
        { type: "Price", ticker: "SPY", lookback: 0, delay: 0, leverage: 1 },
        { type: "SMA", ticker: "SPY", lookback: 200, delay: 0, leverage: 1 },
        ">",
        2,
      ),
    ).toBe("Price SPY > SMA SPY 200 ~2");
  });

  it("omits tolerance when zero", () => {
    expect(
      serializeSignalSpec(
        { type: "SMA", ticker: "SPY", lookback: 50, delay: 0, leverage: 1 },
        { type: "SMA", ticker: "SPY", lookback: 200, delay: 0, leverage: 1 },
        ">",
        0,
      ),
    ).toBe("SMA SPY 50 > SMA SPY 200");
  });

  it("serializes < comparison", () => {
    expect(
      serializeSignalSpec(
        { type: "RSI", ticker: "QQQ", lookback: 10, delay: 0, leverage: 1 },
        { type: "Threshold", ticker: null, lookback: 0, delay: 0, leverage: 1, threshold: 30 },
        "<",
        2,
      ),
    ).toBe("RSI QQQ 10 < Threshold 30 ~2");
  });

  it("serializes = comparison", () => {
    expect(
      serializeSignalSpec(
        { type: "VIX", ticker: null, lookback: 0, delay: 0, leverage: 1 },
        { type: "Threshold", ticker: null, lookback: 0, delay: 0, leverage: 1, threshold: 20 },
        "=",
        0,
      ),
    ).toBe("VIX = Threshold 20");
  });

  it("serializes signal with leveraged ticker", () => {
    expect(
      serializeSignalSpec(
        { type: "RSI", ticker: "QQQ", lookback: 10, delay: 0, leverage: 3 },
        { type: "Threshold", ticker: null, lookback: 0, delay: 0, leverage: 1, threshold: 80 },
        ">",
        2,
      ),
    ).toBe("RSI QQQ?L=3 10 > Threshold 80 ~2");
  });

  it("serializes signal with delay on indicator", () => {
    expect(
      serializeSignalSpec(
        { type: "Price", ticker: "SPY", lookback: 0, delay: 1, leverage: 1 },
        { type: "SMA", ticker: "SPY", lookback: 200, delay: 0, leverage: 1 },
        ">",
        2,
      ),
    ).toBe("Price SPY @1 > SMA SPY 200 ~2");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --reporter verbose 2>&1 | head -30`
Expected: FAIL — `serializeSignalSpec` is not exported

- [ ] **Step 3: Write minimal implementation**

Add to `cli/src/commands/strategy.ts`:

```ts
export function serializeSignalSpec(
  indicator1: SerializableIndicator,
  indicator2: SerializableIndicator,
  comparison: string,
  tolerance: number,
): string {
  const left = serializeIndicatorSpec(indicator1);
  const right = serializeIndicatorSpec(indicator2);
  const spec = `${left} ${comparison} ${right}`;
  return tolerance !== 0 ? `${spec} ~${tolerance}` : spec;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --reporter verbose 2>&1 | tail -20`
Expected: All `serializeSignalSpec` tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/strategy.ts src/commands/strategy.test.ts
git commit -m "feat(cli): add serializeSignalSpec for round-trip output"
```

---

### Task 4: Add `serializeHoldMap` with tests

**Files:**
- Modify: `cli/src/commands/strategy.ts` — add `serializeHoldMap` function
- Modify: `cli/src/commands/strategy.test.ts` — add tests

- [ ] **Step 1: Write the failing tests**

Add to `cli/src/commands/strategy.test.ts`:

```ts
import {
  parseStrategyJson,
  formatHoldings,
  filterChangesOnly,
  serializeTickerSpec,
  serializeIndicatorSpec,
  serializeSignalSpec,
  serializeHoldMap,
} from "./strategy.js";

describe("serializeHoldMap", () => {
  it("serializes single holding", () => {
    expect(
      serializeHoldMap([["CASHX", 1, 1]]),
    ).toEqual({ CASHX: 1 });
  });

  it("serializes multiple holdings", () => {
    expect(
      serializeHoldMap([
        ["GLD", 0.25, 2],
        ["QQQ", 0.75, 2],
      ]),
    ).toEqual({ "GLD?L=2": 0.25, "QQQ?L=2": 0.75 });
  });

  it("omits leverage suffix when leverage is 1", () => {
    expect(
      serializeHoldMap([
        ["SPY", 0.6, 1],
        ["CASHX", 0.4, 1],
      ]),
    ).toEqual({ SPY: 0.6, CASHX: 0.4 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --reporter verbose 2>&1 | head -30`
Expected: FAIL — `serializeHoldMap` is not exported

- [ ] **Step 3: Write minimal implementation**

Add to `cli/src/commands/strategy.ts`:

```ts
export function serializeHoldMap(
  holdings: [string, number, number][],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [symbol, weight, leverage] of holdings) {
    result[serializeTickerSpec(symbol, leverage)] = weight;
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --reporter verbose 2>&1 | tail -20`
Expected: All `serializeHoldMap` tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/strategy.ts src/commands/strategy.test.ts
git commit -m "feat(cli): add serializeHoldMap for round-trip output"
```

---

### Task 5: Add `serializeStrategy` and wire into `makeGetCommand`

**Files:**
- Modify: `cli/src/commands/strategy.ts` — add `serializeStrategy`, update `makeGetCommand`

- [ ] **Step 1: Write `serializeStrategy`**

Add to `cli/src/commands/strategy.ts`:

```ts
import type { StrategyHandle } from "@livefolio/sdk";

export function serializeStrategy(strategy: {
  name: string | null;
  freq: string;
  offset: number;
  rules: {
    when?: { indicator1: { type: string; ticker: { symbol: string; leverage: number } | null; lookback: number; delay: number; threshold: number | null }; indicator2: { type: string; ticker: { symbol: string; leverage: number } | null; lookback: number; delay: number; threshold: number | null }; comparison: string; tolerance: number }[];
    hold: { holdings: [{ symbol: string; leverage: number }, number][] };
  }[];
}): object {
  const rules = strategy.rules.map((rule) => {
    const hold: Record<string, number> = {};
    for (const [ticker, weight] of rule.hold.holdings) {
      hold[serializeTickerSpec(ticker.symbol, ticker.leverage)] = weight;
    }

    if (!rule.when || rule.when.length === 0) {
      return { hold };
    }

    const when = rule.when.map((signal) => {
      const ind1: SerializableIndicator = {
        type: signal.indicator1.type,
        ticker: signal.indicator1.ticker?.symbol ?? null,
        lookback: signal.indicator1.lookback,
        delay: signal.indicator1.delay,
        leverage: signal.indicator1.ticker?.leverage ?? 1,
        threshold: signal.indicator1.threshold,
      };
      const ind2: SerializableIndicator = {
        type: signal.indicator2.type,
        ticker: signal.indicator2.ticker?.symbol ?? null,
        lookback: signal.indicator2.lookback,
        delay: signal.indicator2.delay,
        leverage: signal.indicator2.ticker?.leverage ?? 1,
        threshold: signal.indicator2.threshold,
      };
      return serializeSignalSpec(ind1, ind2, signal.comparison, signal.tolerance);
    });

    return { when, hold };
  });

  return {
    name: strategy.name,
    freq: strategy.freq,
    offset: strategy.offset,
    rules,
  };
}
```

- [ ] **Step 2: Update `makeGetCommand` action**

Replace the action body in `makeGetCommand` (lines 305-325 of `strategy.ts`) with:

```ts
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
    await strategy.resolve();
    const output = serializeStrategy(strategy);
    console.log(JSON.stringify(output, null, 2));
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
});
```

- [ ] **Step 3: Run all tests**

Run: `npm test -- --reporter verbose 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 4: Manual integration test**

Run:
```bash
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_KEY=REDACTED
export FRED_API_KEY=REDACTED
npx tsx src/index.ts strategy get KtD_EUDeUg77VUV118Fm1
```

Expected output:
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

- [ ] **Step 5: Round-trip test — pipe get into post**

Run:
```bash
OUTPUT=$(npx tsx src/index.ts strategy get KtD_EUDeUg77VUV118Fm1)
NEW_ID=$(npx tsx src/index.ts strategy post "$OUTPUT")
npx tsx src/index.ts strategy get "$NEW_ID"
```

Expected: The output of the second `get` should be identical to `$OUTPUT` (same JSON structure, may differ in name if desired).

- [ ] **Step 6: Commit**

```bash
git add src/commands/strategy.ts
git commit -m "feat(cli): make strategy get output post-compatible JSON"
```

---

### Task 6: Add round-trip unit test

**Files:**
- Modify: `cli/src/commands/strategy.test.ts` — add round-trip parse→serialize test

- [ ] **Step 1: Write the round-trip test**

Add to `cli/src/commands/strategy.test.ts`:

```ts
import { parseSignalSpec } from "../lib/parse.js";

describe("round-trip: parseSignalSpec → serializeSignalSpec", () => {
  const cases = [
    "SMA SPY 50 > SMA SPY 200",
    "Price SPY > SMA SPY 200 ~2",
    "RSI QQQ?L=3 10 > Threshold 80 ~2",
    "RSI QQQ 10 < Threshold 30 ~2",
    "VIX > Threshold 20",
    "Price SPY @1 > SMA SPY 200 ~2",
    "T10Y > Threshold 3.5",
  ];

  for (const input of cases) {
    it(`round-trips "${input}"`, () => {
      const parsed = parseSignalSpec(input);
      const ind1: Parameters<typeof serializeSignalSpec>[0] = {
        type: parsed.indicator1.type,
        ticker: parsed.indicator1.ticker ?? null,
        lookback: parsed.indicator1.lookback ?? 0,
        delay: parsed.indicator1.delay ?? 0,
        leverage: parsed.indicator1.leverage ?? 1,
        threshold: parsed.indicator1.value ?? null,
      };
      const ind2: Parameters<typeof serializeSignalSpec>[0] = {
        type: parsed.indicator2.type,
        ticker: parsed.indicator2.ticker ?? null,
        lookback: parsed.indicator2.lookback ?? 0,
        delay: parsed.indicator2.delay ?? 0,
        leverage: parsed.indicator2.leverage ?? 1,
        threshold: parsed.indicator2.value ?? null,
      };
      const output = serializeSignalSpec(ind1, ind2, parsed.comparison, parsed.tolerance);
      expect(output).toBe(input);
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- --reporter verbose 2>&1 | tail -30`
Expected: All round-trip tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/commands/strategy.test.ts
git commit -m "test(cli): add round-trip tests for signal serialization"
```
