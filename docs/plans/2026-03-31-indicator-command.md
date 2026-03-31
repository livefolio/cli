# Indicator Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `livefolio indicator` command that fetches and displays time series data for any market indicator.

**Architecture:** Single commander subcommand with flat `<type> [ticker] [lookback]` positional args. Type-to-category mapping drives validation. Pure formatter functions render DailyBar[] to table/json/csv. Shared client factory reads env vars.

**Tech Stack:** TypeScript, commander.js, @livefolio/sdk, @supabase/supabase-js, vitest

---

## File Structure

```
cli/src/
  commands/
    indicator.ts        — command definition, type mapping, validation, action handler
    indicator.test.ts   — tests for validation and type mapping
  lib/
    client.ts           — creates LivefolioClient from env vars
    format.ts           — table/json/csv formatters for DailyBar[]
    format.test.ts      — tests for formatters
  index.ts              — (modify) register indicator command
```

---

### Task 1: Add @supabase/supabase-js dependency

**Files:**
- Modify: `cli/package.json`

- [ ] **Step 1: Install @supabase/supabase-js**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npm install @supabase/supabase-js`

Expected: package.json updated with `@supabase/supabase-js` in dependencies.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(cli): add @supabase/supabase-js dependency"
```

---

### Task 2: Format utilities (TDD)

**Files:**
- Create: `cli/src/lib/format.ts`
- Test: `cli/src/lib/format.test.ts`

- [ ] **Step 1: Write failing tests for formatters**

Create `cli/src/lib/format.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatTable, formatJson, formatCsv } from './format.js';

const bars = [
  { date: '2025-01-02', value: 478.32 },
  { date: '2025-01-03', value: 479.15 },
  { date: '2025-01-06', value: 1480.01 },
];

describe('formatTable', () => {
  it('formats bars as padded columns', () => {
    const result = formatTable(bars);
    expect(result).toBe(
      [
        'DATE        VALUE',
        '2025-01-02  478.32',
        '2025-01-03  479.15',
        '2025-01-06  1480.01',
      ].join('\n'),
    );
  });

  it('returns empty string for empty array', () => {
    expect(formatTable([])).toBe('');
  });
});

describe('formatJson', () => {
  it('formats bars as JSON array', () => {
    const result = formatJson(bars);
    expect(result).toBe(JSON.stringify(bars, null, 2));
  });

  it('returns empty string for empty array', () => {
    expect(formatJson([])).toBe('');
  });
});

describe('formatCsv', () => {
  it('formats bars as CSV with header', () => {
    const result = formatCsv(bars);
    expect(result).toBe(
      ['date,value', '2025-01-02,478.32', '2025-01-03,479.15', '2025-01-06,1480.01'].join('\n'),
    );
  });

  it('returns empty string for empty array', () => {
    expect(formatCsv([])).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx vitest run src/lib/format.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement formatters**

Create `cli/src/lib/format.ts`:

```typescript
import type { DailyBar } from '@livefolio/sdk';

export function formatTable(bars: DailyBar[]): string {
  if (bars.length === 0) return '';

  const header = 'DATE        VALUE';
  const lines = bars.map((b) => {
    const val = String(b.value);
    return `${b.date}  ${val}`;
  });
  return [header, ...lines].join('\n');
}

export function formatJson(bars: DailyBar[]): string {
  if (bars.length === 0) return '';
  return JSON.stringify(bars, null, 2);
}

export function formatCsv(bars: DailyBar[]): string {
  if (bars.length === 0) return '';
  const lines = bars.map((b) => `${b.date},${b.value}`);
  return ['date,value', ...lines].join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx vitest run src/lib/format.test.ts`

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat(cli): add table/json/csv formatters for DailyBar series"
```

---

### Task 3: Client factory

**Files:**
- Create: `cli/src/lib/client.ts`

- [ ] **Step 1: Implement client factory**

Create `cli/src/lib/client.ts`:

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient, type LivefolioClient, type Database } from '@livefolio/sdk';

export interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  fredApiKey?: string;
}

export function readEnv(): EnvConfig {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    fredApiKey: process.env.FRED_API_KEY,
  };
}

export function buildClient(env: EnvConfig): LivefolioClient {
  const supabase = createSupabaseClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
  return createClient({ supabase, fredApiKey: env.fredApiKey });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/client.ts
git commit -m "feat(cli): add shared client factory for LivefolioClient from env vars"
```

---

### Task 4: Indicator command validation (TDD)

**Files:**
- Create: `cli/src/commands/indicator.ts`
- Test: `cli/src/commands/indicator.test.ts`

- [ ] **Step 1: Write failing tests for type mapping and validation**

Create `cli/src/commands/indicator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveType, validateArgs, TICKER_LOOKBACK_TYPES, TICKER_ONLY_TYPES, STANDALONE_TYPES } from './indicator.js';

describe('resolveType', () => {
  it('maps lowercase to SDK enum value', () => {
    expect(resolveType('sma')).toBe('SMA');
    expect(resolveType('ema')).toBe('EMA');
    expect(resolveType('rsi')).toBe('RSI');
    expect(resolveType('price')).toBe('Price');
    expect(resolveType('return')).toBe('Return');
    expect(resolveType('volatility')).toBe('Volatility');
    expect(resolveType('drawdown')).toBe('Drawdown');
    expect(resolveType('vix')).toBe('VIX');
    expect(resolveType('vix3m')).toBe('VIX3M');
    expect(resolveType('t10y')).toBe('T10Y');
    expect(resolveType('t3m')).toBe('T3M');
  });

  it('is case-insensitive', () => {
    expect(resolveType('SMA')).toBe('SMA');
    expect(resolveType('Sma')).toBe('SMA');
    expect(resolveType('VIX3M')).toBe('VIX3M');
  });

  it('returns null for unknown types', () => {
    expect(resolveType('unknown')).toBeNull();
    expect(resolveType('threshold')).toBeNull();
    expect(resolveType('month')).toBeNull();
  });
});

describe('validateArgs', () => {
  it('requires ticker and lookback for ticker+lookback types', () => {
    for (const t of TICKER_LOOKBACK_TYPES) {
      expect(validateArgs(t, undefined, undefined)).toMatch(/requires <ticker> and <lookback>/);
      expect(validateArgs(t, 'SPY', undefined)).toMatch(/requires <ticker> and <lookback>/);
      expect(validateArgs(t, 'SPY', '200')).toBeNull();
    }
  });

  it('requires ticker for price', () => {
    for (const t of TICKER_ONLY_TYPES) {
      expect(validateArgs(t, undefined, undefined)).toMatch(/requires <ticker>/);
      expect(validateArgs(t, 'AAPL', undefined)).toBeNull();
    }
  });

  it('accepts standalone types with no args', () => {
    for (const t of STANDALONE_TYPES) {
      expect(validateArgs(t, undefined, undefined)).toBeNull();
    }
  });

  it('rejects non-positive-integer lookback', () => {
    expect(validateArgs('SMA', 'SPY', '0')).toMatch(/positive integer/);
    expect(validateArgs('SMA', 'SPY', '-5')).toMatch(/positive integer/);
    expect(validateArgs('SMA', 'SPY', 'abc')).toMatch(/positive integer/);
    expect(validateArgs('SMA', 'SPY', '3.5')).toMatch(/positive integer/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx vitest run src/commands/indicator.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement type mapping and validation**

Create `cli/src/commands/indicator.ts`:

```typescript
import { Command } from 'commander';
import type { LivefolioClient, DailyBar } from '@livefolio/sdk';
import { readEnv, buildClient } from '../lib/client.js';
import { formatTable, formatJson, formatCsv } from '../lib/format.js';

export const TICKER_LOOKBACK_TYPES = ['SMA', 'EMA', 'RSI', 'Return', 'Volatility', 'Drawdown'] as const;
export const TICKER_ONLY_TYPES = ['Price'] as const;
export const STANDALONE_TYPES = [
  'VIX', 'VIX3M', 'T3M', 'T6M', 'T1Y', 'T2Y', 'T3Y', 'T5Y', 'T7Y', 'T10Y', 'T20Y', 'T30Y',
] as const;

const TYPE_MAP: Record<string, string> = {};
for (const t of [...TICKER_LOOKBACK_TYPES, ...TICKER_ONLY_TYPES, ...STANDALONE_TYPES]) {
  TYPE_MAP[t.toLowerCase()] = t;
}

const TREASURY_TYPES = new Set(['T3M', 'T6M', 'T1Y', 'T2Y', 'T3Y', 'T5Y', 'T7Y', 'T10Y', 'T20Y', 'T30Y']);

export function resolveType(input: string): string | null {
  return TYPE_MAP[input.toLowerCase()] ?? null;
}

export function validateArgs(type: string, ticker: string | undefined, lookback: string | undefined): string | null {
  const tlSet = new Set<string>(TICKER_LOOKBACK_TYPES);
  const toSet = new Set<string>(TICKER_ONLY_TYPES);

  if (tlSet.has(type)) {
    if (!ticker || !lookback) {
      return `Error: ${type.toLowerCase()} requires <ticker> and <lookback>`;
    }
    const n = Number(lookback);
    if (!Number.isInteger(n) || n <= 0) {
      return 'Error: lookback must be a positive integer';
    }
  } else if (toSet.has(type)) {
    if (!ticker) {
      return `Error: ${type.toLowerCase()} requires <ticker>`;
    }
  }

  return null;
}

function validateDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

type Format = 'table' | 'json' | 'csv';

function formatBars(bars: DailyBar[], fmt: Format): string {
  switch (fmt) {
    case 'table': return formatTable(bars);
    case 'json': return formatJson(bars);
    case 'csv': return formatCsv(bars);
  }
}

function getAllTypes(): string[] {
  return [...TICKER_LOOKBACK_TYPES, ...TICKER_ONLY_TYPES, ...STANDALONE_TYPES].map((t) => t.toLowerCase());
}

export function makeIndicatorCommand(): Command {
  const cmd = new Command('indicator')
    .description('Fetch indicator time series data')
    .argument('<type>', `indicator type (${getAllTypes().join(', ')})`)
    .argument('[ticker]', 'ticker symbol (required for ticker-bound types)')
    .argument('[lookback]', 'lookback period (required for SMA, EMA, RSI, etc.)')
    .option('--delay <days>', 'delay in days', '0')
    .option('--from <date>', 'start date (YYYY-MM-DD)')
    .option('--to <date>', 'end date (YYYY-MM-DD)')
    .option('--format <fmt>', 'output format: table, json, csv', 'table')
    .action(async (typeArg: string, ticker: string | undefined, lookback: string | undefined, opts) => {
      const type = resolveType(typeArg);
      if (!type) {
        console.error(`Error: unknown indicator type "${typeArg}". Available: ${getAllTypes().join(', ')}`);
        process.exit(1);
      }

      const argError = validateArgs(type, ticker, lookback);
      if (argError) {
        console.error(argError);
        process.exit(1);
      }

      if (opts.from && !validateDate(opts.from)) {
        console.error('Error: --from must be a valid date (YYYY-MM-DD)');
        process.exit(1);
      }
      if (opts.to && !validateDate(opts.to)) {
        console.error('Error: --to must be a valid date (YYYY-MM-DD)');
        process.exit(1);
      }

      const fmt = opts.format as Format;
      if (!['table', 'json', 'csv'].includes(fmt)) {
        console.error(`Error: --format must be table, json, or csv`);
        process.exit(1);
      }

      let env;
      try {
        env = readEnv();
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }

      if (TREASURY_TYPES.has(type) && !env.fredApiKey) {
        console.error('Error: FRED_API_KEY is required for treasury indicators');
        process.exit(1);
      }

      const client = buildClient(env);
      const delay = Number(opts.delay);
      const delayOpt = delay > 0 ? { delay } : undefined;

      let handle;
      const tlSet = new Set<string>(TICKER_LOOKBACK_TYPES);
      const toSet = new Set<string>(TICKER_ONLY_TYPES);

      if (tlSet.has(type)) {
        const t = client.ticker(ticker!);
        const lb = Number(lookback);
        const method = type.toLowerCase() as 'sma' | 'ema' | 'rsi' | 'volatility' | 'drawdown';
        if (type === 'Return') {
          handle = client.returns(t, lb, delayOpt);
        } else {
          handle = client[method](t, lb, delayOpt);
        }
      } else if (toSet.has(type)) {
        handle = client.price(client.ticker(ticker!), delayOpt);
      } else if (type === 'VIX') {
        handle = client.vix(delayOpt);
      } else if (type === 'VIX3M') {
        handle = client.vix3m(delayOpt);
      } else {
        handle = client.treasury(type as Parameters<typeof client.treasury>[0], delayOpt);
      }

      const range = {
        ...(opts.from ? { from: opts.from } : {}),
        ...(opts.to ? { to: opts.to } : {}),
      };

      const bars = await handle.series(Object.keys(range).length > 0 ? range : undefined);

      const output = formatBars(bars, fmt);
      if (output) {
        console.log(output);
      }
    });

  return cmd;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx vitest run src/commands/indicator.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/indicator.ts src/commands/indicator.test.ts
git commit -m "feat(cli): add indicator command with type mapping and validation"
```

---

### Task 5: Wire command into CLI entry point

**Files:**
- Modify: `cli/src/index.ts`

- [ ] **Step 1: Register indicator command**

Update `cli/src/index.ts` to:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { makeIndicatorCommand } from './commands/indicator.js';

const program = new Command();

program.name('livefolio').description('Livefolio CLI').version('0.0.1');

program.addCommand(makeIndicatorCommand());

program.parse();
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Verify help output**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx tsc && node dist/index.js indicator --help`

Expected: Help text showing `indicator <type> [ticker] [lookback]` with all options listed.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(cli): wire indicator command into CLI entry point"
```

---

### Task 6: Run full test suite

- [ ] **Step 1: Run all tests**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npx vitest run`

Expected: All tests pass (format + indicator validation tests).

- [ ] **Step 2: Run linter**

Run: `cd /Users/raksi/Documents/Personal/livefolio-2/cli && npm run lint`

Expected: No errors. If there are lint issues, fix them and commit.
