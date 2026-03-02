import type { Command } from "commander";
import { getAction } from "./get.js";
import { evaluateAction } from "./evaluate.js";

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
    .action(evaluateAction);
}
