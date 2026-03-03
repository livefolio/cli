import { getLivefolio } from "../../config.js";
import { formatObservations } from "../../lib/format.js";

export async function quoteAction(symbols: string[]): Promise<void> {
  if (!symbols.length) {
    process.stderr.write("Error: at least one symbol is required\n");
    process.exitCode = 1;
    return;
  }

  const upper = symbols.map((s) => s.toUpperCase());

  try {
    const quotes = await getLivefolio().market.getBatchQuotes(upper);

    // Wrap each quote as a single-element array so formatObservations works
    const data: Record<string, { timestamp: string; value: number }[]> = {};
    for (const s of upper) {
      const q = quotes[s];
      data[s] = q ? [q] : [];
    }

    console.log(formatObservations(data, upper));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
