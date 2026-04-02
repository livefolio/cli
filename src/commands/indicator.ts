import { Command } from "commander";
import type { DailyBar } from "@livefolio/sdk";
import { readEnv, buildClient } from "../lib/client";
import { formatTable, formatJson, formatCsv } from "../lib/format";
import {
  parseIndicatorSpec,
  buildIndicatorHandle,
  needsFredKey,
} from "../lib/parse";

export const TICKER_LOOKBACK_TYPES = [
  "SMA",
  "EMA",
  "RSI",
  "Return",
  "Volatility",
  "Drawdown",
] as const;
export const TICKER_ONLY_TYPES = ["Price"] as const;
export const STANDALONE_TYPES = [
  "VIX",
  "VIX3M",
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
] as const;

const TYPE_MAP: Record<string, string> = {};
for (const t of [
  ...TICKER_LOOKBACK_TYPES,
  ...TICKER_ONLY_TYPES,
  ...STANDALONE_TYPES,
]) {
  TYPE_MAP[t.toLowerCase()] = t;
}

export function resolveType(input: string): string | null {
  return TYPE_MAP[input.toLowerCase()] ?? null;
}

export function parseTicker(input: string): {
  symbol: string;
  leverage?: number;
} {
  const idx = input.indexOf("?");
  if (idx === -1) return { symbol: input };

  const symbol = input.slice(0, idx);
  const params = new URLSearchParams(input.slice(idx + 1));
  const l = params.get("L");
  if (l === null) return { symbol };

  const leverage = Number(l);
  if (!Number.isInteger(leverage) || leverage <= 0) {
    throw new Error(`Invalid leverage "${l}" — must be a positive integer`);
  }
  return { symbol, leverage };
}

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
