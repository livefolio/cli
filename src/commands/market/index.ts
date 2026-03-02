import type { Command } from "commander";
import { seriesAction } from "./series.js";

export function registerMarket(program: Command): void {
  const market = program
    .command("market")
    .description("Market data commands");

  market
    .command("series <symbol>")
    .description("Fetch historical series for a symbol")
    .action(seriesAction);
}
