import type { Command } from "commander";
import { rebalanceAction } from "./rebalance.js";

export function registerPortfolio(program: Command): void {
  const portfolio = program
    .command("portfolio")
    .description("Portfolio commands");

  portfolio
    .command("rebalance")
    .description("Compute a rebalance plan from target weights, current values, and prices (JSON)")
    .requiredOption("--targets <pairs>", "Target weights as SYMBOL:WEIGHT,... (e.g. SPY:60,QQQ:40)")
    .requiredOption("--current <pairs>", "Current holding values as SYMBOL:VALUE,... (e.g. SPY:800,QQQ:200)")
    .requiredOption("--prices <pairs>", "Current prices as SYMBOL:PRICE,... (e.g. SPY:450,QQQ:380)")
    .requiredOption("--cash <number>", "Available cash in the portfolio (dollars)")
    .requiredOption("--total <number>", "Total portfolio value including cash (dollars)")
    .option("--threshold <number>", "Drift threshold in percentage points before rebalancing triggers")
    .option("--cash-symbol <symbol>", "Treat this symbol as cash (no orders generated for it)")
    .action(rebalanceAction);
}
