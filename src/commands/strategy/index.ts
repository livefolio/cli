import type { Command } from "commander";
import { getAction } from "./get.js";
import { evaluateAction } from "./evaluate.js";
import { evaluateRemoteAction } from "./evaluate-remote.js";
import { initAction } from "./init.js";
import { showAction } from "./show.js";
import { validateAction } from "./validate.js";
import { compileAction } from "./compile.js";
import { backtestAction } from "./backtest.js";
import { setTradingAction } from "./set-trading.js";
import { addSignalAction } from "./add-signal.js";
import { removeSignalAction } from "./remove-signal.js";
import { addAllocationAction } from "./add-allocation.js";
import { removeAllocationAction } from "./remove-allocation.js";
import { collectDslList } from "./dsl.js";
import { publishAction } from "./publish.js";
import { createAction } from "./create.js";

export function registerStrategy(program: Command): void {
  const strategy = program
    .command("strategy")
    .description("Strategy commands");

  strategy
    .command("init")
    .description("Initialize a local strategy authoring file")
    .option("--file <path>", "Path to local strategy JSON", "strategy.json")
    .option("--name <name>", "Strategy name")
    .action(initAction);

  strategy
    .command("create")
    .description("Create a local strategy file from full JSON in one shot")
    .requiredOption("--file <path>", "Path to local strategy JSON")
    .option("--json <string>", "Inline strategy JSON")
    .option("--json-file <path>", "Path to strategy JSON input")
    .action(createAction);

  strategy
    .command("show")
    .description("Show a local strategy file")
    .requiredOption("--file <path>", "Path to local strategy JSON")
    .action(showAction);

  strategy
    .command("validate")
    .description("Validate a local strategy file")
    .requiredOption("--file <path>", "Path to local strategy JSON")
    .action(validateAction);

  strategy
    .command("compile")
    .description("Compile a local strategy file into executable strategy JSON")
    .requiredOption("--file <path>", "Path to local strategy JSON")
    .action(compileAction);

  strategy
    .command("evaluate")
    .description("Evaluate a local strategy file")
    .requiredOption("--file <path>", "Path to local strategy JSON")
    .option("--at <date>", "Evaluation date (YYYY-MM-DD or ISO string)")
    .action(evaluateAction);

  strategy
    .command("backtest")
    .description("Backtest a local strategy file")
    .requiredOption("--file <path>", "Path to local strategy JSON")
    .requiredOption("--start <date>", "Backtest start date (YYYY-MM-DD)")
    .requiredOption("--end <date>", "Backtest end date (YYYY-MM-DD)")
    .option("--debug", "Emit backtest diagnostics to stderr")
    .option("--debug-log-every <days>", "Emit periodic progress every N trading days")
    .action(backtestAction);

  strategy
    .command("set-trading")
    .description("Set local strategy trading settings")
    .requiredOption("--file <path>", "Path to local strategy JSON")
    .requiredOption("--frequency <frequency>", "Trading frequency")
    .requiredOption("--offset <offset>", "Trading offset (integer)")
    .action(setTradingAction);

  strategy
    .command("add-signal")
    .description("Add a signal to a local strategy file")
    .requiredOption("--file <path>", "Path to local strategy JSON")
    .requiredOption("--name <name>", "Signal name identifier")
    .requiredOption("--left <dsl>", 'Left indicator DSL (e.g. "Price(SPY)")')
    .requiredOption("--comparison <comparison>", "Comparison: >, <, or =")
    .requiredOption("--right <dsl>", 'Right indicator DSL (e.g. "SMA(SPY,200)")')
    .option("--tolerance <pct>", "Tolerance percentage", "0")
    .action(addSignalAction);

  strategy
    .command("remove-signal")
    .description("Remove a signal from a local strategy file")
    .requiredOption("--file <path>", "Path to local strategy JSON")
    .requiredOption("--name <name>", "Signal name identifier")
    .action(removeSignalAction);

  strategy
    .command("add-allocation")
    .description("Add an allocation to a local strategy file")
    .requiredOption("--file <path>", "Path to local strategy JSON")
    .requiredOption("--name <name>", "Allocation name")
    .requiredOption("--condition <expr>", "Condition DSL expression")
    .requiredOption(
      "--holding <dsl>",
      'Holding DSL (repeatable or comma-separated, e.g. "SPY:60,GLD:40")',
      collectDslList,
      [],
    )
    .option("--rebalance-mode <mode>", "Rebalance mode: on_change|drift|calendar")
    .option("--drift-pct <pct>", "Drift threshold percentage")
    .option("--calendar-frequency <freq>", "Calendar rebalance frequency: Daily|Monthly|Yearly")
    .action(addAllocationAction);

  strategy
    .command("remove-allocation")
    .description("Remove an allocation from a local strategy file")
    .requiredOption("--file <path>", "Path to local strategy JSON")
    .requiredOption("--name <name>", "Allocation name")
    .action(removeAllocationAction);

  strategy
    .command("publish")
    .description("Persist local strategy and return a shareable link")
    .requiredOption("--file <path>", "Path to local strategy JSON")
    .option("--start <date>", "Run backtest during publish: start date (YYYY-MM-DD)")
    .option("--end <date>", "Run backtest during publish: end date (YYYY-MM-DD)")
    .option("--backtest-file <path>", "Attach backtest from JSON file")
    .option("--base-url <url>", "Base URL for resulting strategy link", "http://localhost:3000")
    .option("--no-write-link-id", "Do not write persisted linkId back into the local strategy file")
    .action(publishAction);

  strategy
    .command("get <link_id>")
    .description("Fetch a strategy definition and output as JSON")
    .action(getAction);

  strategy
    .command("evaluate-remote <link_id>")
    .description("Evaluate a persisted remote strategy and output JSON")
    .option("--at <date>", "Evaluation date (YYYY-MM-DD or ISO string, defaults to now)")
    .action(evaluateRemoteAction);
}
