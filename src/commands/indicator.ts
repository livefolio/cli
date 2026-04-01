import { Command } from "commander";
import type { DailyBar } from "@livefolio/sdk";
import { readEnv, buildClient } from "../lib/client.js";
import { formatTable, formatJson, formatCsv } from "../lib/format.js";

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

export function resolveType(input: string): string | null {
  return TYPE_MAP[input.toLowerCase()] ?? null;
}

export function validateArgs(
  type: string,
  ticker: string | undefined,
  lookback: string | undefined,
): string | null {
  const tlSet = new Set<string>(TICKER_LOOKBACK_TYPES);
  const toSet = new Set<string>(TICKER_ONLY_TYPES);

  if (tlSet.has(type)) {
    if (!ticker || !lookback) {
      return `Error: ${type.toLowerCase()} requires <ticker> and <lookback>`;
    }
    const n = Number(lookback);
    if (!Number.isInteger(n) || n <= 0) {
      return "Error: lookback must be a positive integer";
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

function getAllTypes(): string[] {
  return [
    ...TICKER_LOOKBACK_TYPES,
    ...TICKER_ONLY_TYPES,
    ...STANDALONE_TYPES,
  ].map((t) => t.toLowerCase());
}

export function makeIndicatorCommand(): Command {
  const cmd = new Command("indicator")
    .description("Fetch indicator time series data")
    .argument("<type>", `indicator type (${getAllTypes().join(", ")})`)
    .argument("[ticker]", "ticker symbol (required for ticker-bound types)")
    .argument(
      "[lookback]",
      "lookback period (required for SMA, EMA, RSI, etc.)",
    )
    .option("--delay <days>", "delay in days", "0")
    .option("--from <date>", "start date (YYYY-MM-DD)")
    .option("--to <date>", "end date (YYYY-MM-DD)")
    .option("--format <fmt>", "output format: table, json, csv", "table")
    .action(
      async (
        typeArg: string,
        ticker: string | undefined,
        lookback: string | undefined,
        opts,
      ) => {
        const type = resolveType(typeArg);
        if (!type) {
          console.error(
            `Error: unknown indicator type "${typeArg}". Available: ${getAllTypes().join(", ")}`,
          );
          process.exit(1);
        }

        const argError = validateArgs(type, ticker, lookback);
        if (argError) {
          console.error(argError);
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
          console.error(
            "Error: FRED_API_KEY is required for treasury indicators",
          );
          process.exit(1);
        }

        const client = buildClient(env);
        const delay = Number(opts.delay);
        const delayOpt = delay > 0 ? { delay } : undefined;

        try {
          let handle;
          const tlSet = new Set<string>(TICKER_LOOKBACK_TYPES);
          const toSet = new Set<string>(TICKER_ONLY_TYPES);

          if (tlSet.has(type)) {
            const t = client.ticker(ticker!);
            const lb = Number(lookback);
            const method = type.toLowerCase() as
              | "sma"
              | "ema"
              | "rsi"
              | "volatility"
              | "drawdown";
            if (type === "Return") {
              handle = client.returns(t, lb, delayOpt);
            } else {
              handle = client[method](t, lb, delayOpt);
            }
          } else if (toSet.has(type)) {
            handle = client.price(client.ticker(ticker!), delayOpt);
          } else if (type === "VIX") {
            handle = client.vix(delayOpt);
          } else if (type === "VIX3M") {
            handle = client.vix3m(delayOpt);
          } else {
            handle = client.treasury(
              type as Parameters<typeof client.treasury>[0],
              delayOpt,
            );
          }

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
      },
    );

  return cmd;
}
