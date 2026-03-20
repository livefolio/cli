import type { Command } from "commander";
import { getAction } from "./get.js";
import { evaluateAction } from "./evaluate.js";
import { compileDraftAction } from "./compile-draft.js";
import { backtestDraftAction } from "./backtest-draft.js";

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
    .command("compile-draft <file>")
    .description("Compile a strategy-builder draft JSON file into executable strategy JSON")
    .action(compileDraftAction);

  strategy
    .command("backtest-draft <file>")
    .description("Run a strategy-builder draft JSON file through the SDK backtest")
    .requiredOption("--start <date>", "Backtest start date (YYYY-MM-DD)")
    .requiredOption("--end <date>", "Backtest end date (YYYY-MM-DD)")
    .option("--initial-capital <amount>", "Initial capital (defaults to SDK/app default)")
    .action(backtestDraftAction);
}
