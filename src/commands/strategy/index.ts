import type { Command } from "commander";
import { getAction } from "./get.js";
import { evaluateAction } from "./evaluate.js";
import { streamAction } from "./stream.js";
import { symbolsAction } from "./symbols.js";

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
    .command("stream <link_id>")
    .description("Stream live observations and output evaluations as JSONL")
    .action(streamAction);

  strategy
    .command("symbols <link_id>")
    .description("List symbols used by a strategy (one per line)")
    .action(symbolsAction);
}
