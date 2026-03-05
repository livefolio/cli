import type { StreamObservation } from "@livefolio/sdk/strategy";
import { getLivefolio } from "../../config.js";
import { readStdin } from "../../lib/stdin.js";

export function parseCsvObservations(raw: string): StreamObservation[] {
  const lines = raw.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) {
    throw new Error("no data rows in CSV input");
  }

  // Skip header if present
  const start = lines[0] === "symbol,timestamp,price" ? 1 : 0;
  const dataLines = lines.slice(start);

  if (dataLines.length === 0) {
    throw new Error("no data rows in CSV input");
  }

  return dataLines.map((line, i) => {
    const fields = line.split(",");
    if (fields.length !== 3) {
      throw new Error(`invalid CSV row ${i + 1 + start}: expected 3 fields, got ${fields.length}`);
    }
    const [symbol, timestamp, priceStr] = fields;
    const value = parseFloat(priceStr);
    if (isNaN(value)) {
      throw new Error(`invalid CSV row ${i + 1 + start}: price "${priceStr}" is not a number`);
    }
    return { symbol, timestamp, value };
  });
}

export async function streamAction(linkId: string): Promise<void> {
  try {
    const raw = await readStdin();

    let observations: StreamObservation[];
    try {
      observations = parseCsvObservations(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exitCode = 1;
      return;
    }

    const strategy = await getLivefolio().strategy.get(linkId);

    if (!strategy) {
      process.stderr.write(`Error: strategy not found for link ID "${linkId}"\n`);
      process.exitCode = 1;
      return;
    }

    const result = await getLivefolio().strategy.stream(strategy, observations);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
