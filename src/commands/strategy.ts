import { Command } from "commander";
import { readEnv, buildClient } from "../lib/client.js";
import {
  parseSignalSpec,
  buildSignalHandle,
  needsFredKey,
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

    if (!rule.hold || typeof rule.hold !== "object") {
      throw new Error(`Rule ${i + 1}: hold is required`);
    }

    if (isLast && hasWhen) {
      throw new Error("Last rule must be a fallback (no when clause)");
    }
    if (!isLast && !hasWhen) {
      throw new Error(`Non-fallback rule ${i + 1} must have a when clause`);
    }

    const signals: SignalSpec[] = [];
    if (hasWhen) {
      const whenArr = rule.when as string[];
      for (const spec of whenArr) {
        signals.push(parseSignalSpec(spec));
      }
    }

    const hold = rule.hold as Record<string, number>;
    const weightSum = Object.values(hold).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1) > 1e-9) {
      throw new Error(
        `Rule ${i + 1}: hold weights must sum to 1, got ${weightSum}`,
      );
    }

    rules.push({
      signals,
      hold,
    });
  }

  return { name: obj.name, freq, offset, rules };
}

function buildStrategyHandles(client: LivefolioClient, parsed: ParsedStrategy) {
  const rules = parsed.rules.map((rule) => {
    const when = rule.signals.map((sig) =>
      buildSignalHandle(client, sig, sig.tolerance),
    );

    const holdPairs = Object.entries(rule.hold).map(([sym, weight]) => {
      const { symbol, leverage } = parseTicker(sym);
      return [client.ticker(symbol, leverage), weight] as [
        ReturnType<LivefolioClient["ticker"]>,
        number,
      ];
    });
    const hold = client.allocation(...holdPairs);

    return when.length > 0 ? { when, hold } : { hold };
  });

  return client.strategy({
    name: parsed.name,
    freq: parsed.freq as
      | "Daily"
      | "Weekly"
      | "Monthly"
      | "Quarterly"
      | "Yearly",
    offset: parsed.offset,
    rules,
  });
}

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

interface SeriesRow {
  date: string;
  holdings: [{ symbol: string; leverage: number }, number][];
}

function holdingsKey(
  holdings: [{ symbol: string; leverage: number }, number][],
): string {
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
            (r, i) => `│ ${r.date} │ ${allocStrs[i].padEnd(allocWidth)} │`,
          );

          console.log([top, header, mid, ...tableRows, bot].join("\n"));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });
}

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
