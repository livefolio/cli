# Signal Tolerance & Indicator Delay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-signal `~tolerance` and per-indicator `@delay` inline syntax to signal spec strings used by `parseSignalSpec` and the strategy command.

**Architecture:** Extend `parseIndicatorSpec` to strip trailing `@<int>` for delay, extend `parseSignalSpec` to strip trailing `~<number>` for tolerance. Pass delay through `buildIndicatorHandle` and tolerance through `buildSignalHandle`. No SDK changes needed.

**Tech Stack:** TypeScript, Vitest, Commander.js CLI

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `cli/src/lib/parse.ts` | Modify | Add delay to `IndicatorSpec`, tolerance to `SignalSpec`, update parsers and builders |
| `cli/src/lib/parse.test.ts` | Modify | Tests for delay and tolerance parsing |
| `cli/src/commands/strategy.ts` | Modify | Pass `sig.tolerance` to `buildSignalHandle` |
| `cli/src/commands/strategy.test.ts` | Modify | Test strategy JSON with tolerance and delay |

---

### Task 1: Add delay parsing to `parseIndicatorSpec`

**Files:**
- Modify: `cli/src/lib/parse.ts:20-26` (IndicatorSpec type)
- Modify: `cli/src/lib/parse.ts:38-97` (parseIndicatorSpec function)
- Modify: `cli/src/lib/parse.test.ts`

- [ ] **Step 1: Write failing tests for indicator delay parsing**

Add to `cli/src/lib/parse.test.ts`:

```typescript
import { parseIndicatorSpec } from "./parse.js";

describe("parseIndicatorSpec", () => {
  it("parses indicator with delay", () => {
    expect(parseIndicatorSpec("SMA SPY 200 @1")).toEqual({
      type: "SMA",
      ticker: "SPY",
      lookback: 200,
      delay: 1,
    });
  });

  it("parses indicator with negative delay", () => {
    expect(parseIndicatorSpec("RSI QQQ 10 @-1")).toEqual({
      type: "RSI",
      ticker: "QQQ",
      lookback: 10,
      delay: -1,
    });
  });

  it("parses standalone indicator with delay", () => {
    expect(parseIndicatorSpec("VIX @2")).toEqual({
      type: "VIX",
      delay: 2,
    });
  });

  it("parses price indicator with delay", () => {
    expect(parseIndicatorSpec("Price SPY @1")).toEqual({
      type: "Price",
      ticker: "SPY",
      delay: 1,
    });
  });

  it("parses indicator without delay (unchanged)", () => {
    expect(parseIndicatorSpec("SMA SPY 200")).toEqual({
      type: "SMA",
      ticker: "SPY",
      lookback: 200,
    });
  });

  it("throws on non-integer delay", () => {
    expect(() => parseIndicatorSpec("SMA SPY 200 @1.5")).toThrow(
      /delay.*integer/i,
    );
  });

  it("throws on invalid delay value", () => {
    expect(() => parseIndicatorSpec("SMA SPY 200 @abc")).toThrow(
      /delay.*integer/i,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd cli && npx vitest run src/lib/parse.test.ts`
Expected: FAIL — `parseIndicatorSpec` is not exported, and delay is not parsed.

- [ ] **Step 3: Export `parseIndicatorSpec` and add delay parsing**

In `cli/src/lib/parse.ts`, add `delay` to the `IndicatorSpec` interface:

```typescript
export interface IndicatorSpec {
  type: string;
  ticker?: string;
  leverage?: number;
  lookback?: number;
  value?: number;
  delay?: number;
}
```

Update `parseIndicatorSpec` to strip `@<int>` from the last token before other parsing:

```typescript
export function parseIndicatorSpec(input: string): IndicatorSpec {
  const parts = input.trim().split(/\s+/);

  // Check for trailing @<delay>
  let delay: number | undefined;
  const lastPart = parts[parts.length - 1];
  if (lastPart.startsWith("@")) {
    const d = Number(lastPart.slice(1));
    if (!Number.isInteger(d)) {
      throw new Error("Delay must be an integer");
    }
    delay = d;
    parts.pop();
  }

  const rawType = parts[0];

  if (isThresholdType(rawType)) {
    if (parts.length < 2) {
      throw new Error("Threshold requires a <value>");
    }
    const v = Number(parts[1]);
    if (isNaN(v)) {
      throw new Error(`Threshold value must be a number, got "${parts[1]}"`);
    }
    // Thresholds ignore delay (static value)
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
      ...(delay !== undefined && { delay }),
    };
  }

  if (toSet.has(type)) {
    if (parts.length < 2) {
      throw new Error(`${type.toLowerCase()} requires <ticker>`);
    }
    const parsed = parseTicker(parts[1]);
    return {
      type,
      ticker: parsed.symbol,
      leverage: parsed.leverage,
      ...(delay !== undefined && { delay }),
    };
  }

  return { type, ...(delay !== undefined && { delay }) };
}
```

Also add `parseIndicatorSpec` to the exports if not already exported (it already has `export` keyword).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd cli && npx vitest run src/lib/parse.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/parse.ts cli/src/lib/parse.test.ts
git commit -m "feat(cli): add @delay parsing to parseIndicatorSpec"
```

---

### Task 2: Add tolerance parsing to `parseSignalSpec`

**Files:**
- Modify: `cli/src/lib/parse.ts:30-34` (SignalSpec type)
- Modify: `cli/src/lib/parse.ts:103-127` (parseSignalSpec function)
- Modify: `cli/src/lib/parse.test.ts`

- [ ] **Step 1: Write failing tests for signal tolerance parsing**

Add to `cli/src/lib/parse.test.ts` inside the existing `parseSignalSpec` describe block:

```typescript
it("parses signal with tolerance", () => {
  expect(parseSignalSpec("SMA SPY 50 > SMA SPY 200 ~2")).toEqual({
    indicator1: { type: "SMA", ticker: "SPY", lookback: 50 },
    indicator2: { type: "SMA", ticker: "SPY", lookback: 200 },
    comparison: ">",
    tolerance: 2,
  });
});

it("parses signal with float tolerance", () => {
  expect(parseSignalSpec("Price SPY > SMA SPY 200 ~0.5")).toEqual({
    indicator1: { type: "Price", ticker: "SPY" },
    indicator2: { type: "SMA", ticker: "SPY", lookback: 200 },
    comparison: ">",
    tolerance: 0.5,
  });
});

it("parses signal without tolerance (defaults to 0)", () => {
  const result = parseSignalSpec("SMA SPY 50 > SMA SPY 200");
  expect(result.tolerance).toBe(0);
});

it("parses signal with delay and tolerance combined", () => {
  expect(parseSignalSpec("Price SPY @1 > SMA SPY 200 ~2")).toEqual({
    indicator1: { type: "Price", ticker: "SPY", delay: 1 },
    indicator2: { type: "SMA", ticker: "SPY", lookback: 200 },
    comparison: ">",
    tolerance: 2,
  });
});

it("parses signal with delay on indicator2 and tolerance", () => {
  expect(parseSignalSpec("SMA SPY 50 > SMA SPY 200 @1 ~2")).toEqual({
    indicator1: { type: "SMA", ticker: "SPY", lookback: 50 },
    indicator2: { type: "SMA", ticker: "SPY", lookback: 200, delay: 1 },
    comparison: ">",
    tolerance: 2,
  });
});

it("throws on negative tolerance", () => {
  expect(() => parseSignalSpec("SMA SPY 50 > SMA SPY 200 ~-1")).toThrow(
    /tolerance.*non-negative/i,
  );
});

it("throws on invalid tolerance value", () => {
  expect(() => parseSignalSpec("SMA SPY 50 > SMA SPY 200 ~abc")).toThrow(
    /tolerance.*number/i,
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd cli && npx vitest run src/lib/parse.test.ts`
Expected: FAIL — tolerance not parsed, existing tests may also fail if `tolerance: 0` is now expected.

- [ ] **Step 3: Add tolerance to `SignalSpec` and update `parseSignalSpec`**

In `cli/src/lib/parse.ts`, update the `SignalSpec` interface:

```typescript
export interface SignalSpec {
  indicator1: IndicatorSpec;
  indicator2: IndicatorSpec;
  comparison: Comparison;
  tolerance: number;
}
```

Update `parseSignalSpec`:

```typescript
export function parseSignalSpec(input: string): SignalSpec {
  // Strip trailing ~<tolerance> before parsing
  let tolerance = 0;
  let remaining = input.trim();
  const tolMatch = remaining.match(/ ~(\S+)$/);
  if (tolMatch) {
    const t = Number(tolMatch[1]);
    if (isNaN(t)) {
      throw new Error("Tolerance must be a number");
    }
    if (t < 0) {
      throw new Error("Tolerance must be non-negative");
    }
    tolerance = t;
    remaining = remaining.slice(0, tolMatch.index!).trim();
  }

  const match = remaining.match(OPERATOR_RE);
  if (!match || match.index === undefined) {
    throw new Error(
      `Invalid signal spec "${input}". Expected format: "<indicator> > <indicator>"`,
    );
  }

  const comparison = match[1] as Comparison;
  const ind1Str = remaining.slice(0, match.index).trim();
  const ind2Str = remaining.slice(match.index + match[0].length).trim();

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
    tolerance,
  };
}
```

- [ ] **Step 4: Update existing tests to include `tolerance: 0`**

All existing `parseSignalSpec` tests that use `toEqual` need `tolerance: 0` added to the expected object. Update the following tests:

```typescript
it("parses greater-than signal", () => {
  expect(parseSignalSpec("SMA SPY 50 > SMA SPY 200")).toEqual({
    indicator1: { type: "SMA", ticker: "SPY", lookback: 50 },
    indicator2: { type: "SMA", ticker: "SPY", lookback: 200 },
    comparison: ">",
    tolerance: 0,
  });
});

it("parses less-than signal", () => {
  expect(parseSignalSpec("RSI SPY 14 < Threshold 30")).toEqual({
    indicator1: { type: "RSI", ticker: "SPY", lookback: 14 },
    indicator2: { type: "Threshold", value: 30 },
    comparison: "<",
    tolerance: 0,
  });
});

it("parses equals signal", () => {
  expect(parseSignalSpec("VIX = Threshold 20")).toEqual({
    indicator1: { type: "VIX" },
    indicator2: { type: "Threshold", value: 20 },
    comparison: "=",
    tolerance: 0,
  });
});

it("parses standalone indicators", () => {
  expect(parseSignalSpec("VIX > VIX3M")).toEqual({
    indicator1: { type: "VIX" },
    indicator2: { type: "VIX3M" },
    comparison: ">",
    tolerance: 0,
  });
});

it("parses ticker with leverage", () => {
  expect(parseSignalSpec("Price SPY?L=3 > SMA SPY?L=3 200")).toEqual({
    indicator1: { type: "Price", ticker: "SPY", leverage: 3 },
    indicator2: { type: "SMA", ticker: "SPY", leverage: 3, lookback: 200 },
    comparison: ">",
    tolerance: 0,
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd cli && npx vitest run src/lib/parse.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add cli/src/lib/parse.ts cli/src/lib/parse.test.ts
git commit -m "feat(cli): add ~tolerance parsing to parseSignalSpec"
```

---

### Task 3: Pass delay through `buildIndicatorHandle`

**Files:**
- Modify: `cli/src/lib/parse.ts:148-182` (buildIndicatorHandle function)

- [ ] **Step 1: Update `buildIndicatorHandle` to pass delay**

In `cli/src/lib/parse.ts`, update `buildIndicatorHandle`:

```typescript
export function buildIndicatorHandle(
  client: LivefolioClient,
  spec: IndicatorSpec,
) {
  const tlSet = new Set<string>(TICKER_LOOKBACK_TYPES);
  const toSet = new Set<string>(TICKER_ONLY_TYPES);
  const delayOpt = spec.delay ? { delay: spec.delay } : undefined;

  if (spec.type === THRESHOLD_TYPE) {
    return client.threshold(spec.value!);
  }

  if (tlSet.has(spec.type)) {
    const t = client.ticker(spec.ticker!, spec.leverage);
    const lb = spec.lookback!;
    if (spec.type === "Return") {
      return client.returns(t, lb, delayOpt);
    }
    const method = spec.type.toLowerCase() as
      | "sma"
      | "ema"
      | "rsi"
      | "volatility"
      | "drawdown";
    return client[method](t, lb, delayOpt);
  }

  if (toSet.has(spec.type)) {
    return client.price(client.ticker(spec.ticker!, spec.leverage), delayOpt);
  }

  if (spec.type === "VIX") return client.vix(delayOpt);
  if (spec.type === "VIX3M") return client.vix3m(delayOpt);

  return client.treasury(
    spec.type as Parameters<typeof client.treasury>[0],
    delayOpt,
  );
}
```

- [ ] **Step 2: Run all CLI tests to verify no regressions**

Run: `cd cli && npx vitest run`
Expected: PASS — no behavior change for specs without delay.

- [ ] **Step 3: Commit**

```bash
git add cli/src/lib/parse.ts
git commit -m "feat(cli): pass indicator delay through buildIndicatorHandle"
```

---

### Task 4: Pass tolerance through strategy command

**Files:**
- Modify: `cli/src/commands/strategy.ts:111` (buildStrategyHandles)
- Modify: `cli/src/commands/strategy.test.ts`

- [ ] **Step 1: Write failing test for strategy with tolerance**

Add to `cli/src/commands/strategy.test.ts`:

```typescript
it("parses strategy with signal tolerance", () => {
  const input = JSON.stringify({
    name: "Tolerant",
    rules: [
      {
        when: ["SMA SPY 50 > SMA SPY 200 ~2"],
        hold: { SPY: 1 },
      },
      { hold: { CASHX: 1 } },
    ],
  });
  const result = parseStrategyJson(input);
  expect(result.rules[0].signals[0].tolerance).toBe(2);
});

it("parses strategy with signal delay and tolerance", () => {
  const input = JSON.stringify({
    name: "Full",
    rules: [
      {
        when: ["Price SPY @1 > SMA SPY 200 ~2"],
        hold: { SPY: 1 },
      },
      { hold: { CASHX: 1 } },
    ],
  });
  const result = parseStrategyJson(input);
  expect(result.rules[0].signals[0].indicator1.delay).toBe(1);
  expect(result.rules[0].signals[0].tolerance).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it passes** (parsing already works from Task 2)

Run: `cd cli && npx vitest run src/commands/strategy.test.ts`
Expected: PASS — `parseStrategyJson` calls `parseSignalSpec` which already handles `~` and `@`.

- [ ] **Step 3: Update existing strategy test to include `tolerance: 0`**

Update the first test's signal expectation in `strategy.test.ts`:

```typescript
expect(result.rules[0].signals[0]).toEqual({
  indicator1: { type: "SMA", ticker: "SPY", lookback: 50 },
  indicator2: { type: "SMA", ticker: "SPY", lookback: 200 },
  comparison: ">",
  tolerance: 0,
});
```

- [ ] **Step 4: Pass tolerance in `buildStrategyHandles`**

In `cli/src/commands/strategy.ts`, update line 111:

```typescript
// Before:
const when = rule.signals.map((sig) => buildSignalHandle(client, sig));

// After:
const when = rule.signals.map((sig) =>
  buildSignalHandle(client, sig, sig.tolerance),
);
```

- [ ] **Step 5: Run all CLI tests**

Run: `cd cli && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add cli/src/commands/strategy.ts cli/src/commands/strategy.test.ts
git commit -m "feat(cli): pass tolerance and delay through strategy command"
```
