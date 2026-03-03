import { getLivefolio } from "../../config.js";
import { formatObservations } from "../../lib/format.js";

export async function seriesAction(symbols: string[]): Promise<void> {
  if (!symbols.length) {
    process.stderr.write("Error: at least one symbol is required\n");
    process.exitCode = 1;
    return;
  }

  const upper = symbols.map((s) => s.toUpperCase());

  try {
    const batch = await getLivefolio().market.getBatchSeries(upper);
    console.log(formatObservations(batch, upper));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
