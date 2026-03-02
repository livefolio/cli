import { getLivefolio } from "../../config.js";
import { formatSeries } from "../../lib/format.js";

export async function seriesAction(symbol: string): Promise<void> {
  const upper = symbol.toUpperCase();

  try {
    const observations = await getLivefolio().market.getSeries(upper);
    console.log(formatSeries(observations));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
