import { Command } from "commander";
import type { DailyBar } from "@livefolio/sdk";
import { readEnv, buildClient } from "../lib/client.js";
import { formatTable, formatJson, formatCsv } from "../lib/format.js";
import {
  resolveType,
  parseTicker,
  TICKER_LOOKBACK_TYPES,
  TICKER_ONLY_TYPES,
  STANDALONE_TYPES,
} from "./indicator.js";

// --- Threshold handling (not in indicator.ts) ---

const THRESHOLD_TYPE = "Threshold";

function isThresholdType(input: string): boolean {
  return input.toLowerCase() === "threshold";
}

// --- All valid types including threshold ---

const ALL_TYPES = [
  ...TICKER_LOOKBACK_TYPES,
  ...TICKER_ONLY_TYPES,
  ...STANDALONE_TYPES,
].map((t) => t.toLowerCase());

// --- Exported helpers ---

export interface IndicatorSpec {
  type: string;
  ticker?: string;
  leverage?: number;
  lookback?: number;
  value?: number;
}

export function parseIndicatorSpec(input: string): IndicatorSpec {
  const parts = input.trim().split(/\s+/);
  const rawType = parts[0];

  // Handle threshold specially
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
    throw new Error(
      `Unknown indicator type "${rawType}". Available: ${ALL_TYPES.join(", ")}`,
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

  // Standalone
  return { type };
}

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

// --- Command builder ---

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

function needsFredKey(spec: IndicatorSpec): boolean {
  return TREASURY_TYPES.has(spec.type);
}

function buildHandle(
  client: ReturnType<typeof buildClient>,
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

export function makeSignalCommand(): Command {
  const cmd = new Command("signal")
    .description("Evaluate a signal comparing two indicators")
    .argument("<comparison>", "comparison operator: gt, lt, eq")
    .argument("<indicator1>", 'first indicator spec (e.g. "price SPY")')
    .argument("<indicator2>", 'second indicator spec (e.g. "sma SPY 200")')
    .option("--tolerance <n>", "tolerance for comparison", "0")
    .option("--from <date>", "start date (YYYY-MM-DD)")
    .option("--to <date>", "end date (YYYY-MM-DD)")
    .option("--format <fmt>", "output format: table, json, csv", "table")
    .option("--latest", "show only the latest value")
    .action(async (compArg: string, ind1Arg: string, ind2Arg: string, opts) => {
      const validationError = validateSignalArgs(compArg, ind1Arg, ind2Arg, {
        tolerance: opts.tolerance,
      });
      if (validationError) {
        console.error(validationError);
        process.exit(1);
      }

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

      let env;
      try {
        env = readEnv();
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }

      const spec1 = parseIndicatorSpec(ind1Arg);
      const spec2 = parseIndicatorSpec(ind2Arg);

      if ((needsFredKey(spec1) || needsFredKey(spec2)) && !env.fredApiKey) {
        console.error(
          "Error: FRED_API_KEY is required for treasury indicators",
        );
        process.exit(1);
      }

      const client = buildClient(env);
      const comp = resolveComparison(compArg)!;
      const tolerance = Number(opts.tolerance);

      try {
        const handle1 = buildHandle(client, spec1);
        const handle2 = buildHandle(client, spec2);

        let signalHandle;
        if (comp === ">") {
          signalHandle = client.gt(handle1, handle2, tolerance);
        } else if (comp === "<") {
          signalHandle = client.lt(handle1, handle2, tolerance);
        } else {
          signalHandle = client.eq(handle1, handle2, tolerance);
        }

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
