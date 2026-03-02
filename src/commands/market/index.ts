import type { Command } from "commander";
import { seriesAction } from "./series.js";
import { quoteAction } from "./quote.js";

export function registerMarket(program: Command): void {
  const market = program
    .command("market")
    .description("Market data commands");

  market
    .command("series <symbols...>")
    .description("Fetch historical series for one or more symbols")
    .action(seriesAction);

  market
    .command("quotes <symbols...>")
    .description("Get current price for one or more symbols")
    .action(quoteAction);
}
