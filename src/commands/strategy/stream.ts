import { createInterface } from "node:readline";
import { getLivefolio } from "../../config.js";

export async function streamAction(linkId: string): Promise<void> {
  try {
    const strategy = await getLivefolio().strategy.get(linkId);

    if (!strategy) {
      process.stderr.write(`Error: strategy not found for link ID "${linkId}"\n`);
      process.exitCode = 1;
      return;
    }

    const streamer = await getLivefolio().strategy.createStreamer(strategy);

    const rl = createInterface({ input: process.stdin });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const observation = JSON.parse(trimmed);
        const result = streamer.update(observation);
        console.log(JSON.stringify(result));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Error: ${message}\n`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
