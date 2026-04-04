import { getLivefolio } from "../../config.js";

export async function confirmAction(batchId: string): Promise<void> {
  try {
    const result = await getLivefolio().autodeploy.confirmBatch(batchId);

    // Convert Map to a plain object for JSON serialization
    const resultsObj: Record<string, unknown> = {};
    for (const [key, value] of result.results) {
      resultsObj[String(key)] = value;
    }

    console.log(JSON.stringify({ batchId, results: resultsObj }, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
