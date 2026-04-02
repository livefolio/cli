import { Command } from "commander";
import type { DailyBar } from "@livefolio/sdk";
import { readEnv, buildClient } from "../lib/client";
import { formatTable, formatJson, formatCsv } from "../lib/format";
import { parseSignalSpec, buildSignalHandle, needsFredKey } from "../lib/parse";

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
