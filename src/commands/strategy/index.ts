import type { Command } from "commander";
import { getAction } from "./get.js";
import { evaluateAction } from "./evaluate.js";
import { backtestAction } from "./backtest.js";
import { streamAction } from "./stream.js";

export function registerStrategy(program: Command): void {
  const strategy = program
    .command("strategy")
    .description("Strategy commands");

  strategy
    .command("get <link_id>")
    .description("Fetch a strategy definition and output as JSON")
    .action(getAction);

  strategy
    .command("evaluate <link_id>")
    .description("Evaluate a strategy and output the result as JSON")
    .option("--at <date>", "Evaluation date (YYYY-MM-DD or ISO string, defaults to now)")
    .action(evaluateAction);

  strategy
    .command("backtest <link_id>")
    .description("Run a backtest for a strategy")
    .option("--start <date>", "Start date (YYYY-MM-DD, defaults to 2020-01-01)")
    .option("--end <date>", "End date (YYYY-MM-DD, defaults to today)")
    .action(backtestAction);

  strategy
    .command("stream <link_id>")
    .description("Evaluate a strategy with a live observation")
    .requiredOption("--symbol <symbol>", "Ticker symbol")
    .requiredOption("--price <price>", "Current price")
    .option("--timestamp <timestamp>", "Observation timestamp (ISO string, defaults to now)")
    .action(streamAction);
}
