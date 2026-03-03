import { getLivefolio } from "../../config.js";

export async function evaluateAction(linkId: string, options: { at?: string }): Promise<void> {
  try {
    const at = options.at ? new Date(options.at) : new Date();

    if (isNaN(at.getTime())) {
      process.stderr.write(`Error: invalid date "${options.at}"\n`);
      process.exitCode = 1;
      return;
    }

    const strategy = await getLivefolio().strategy.get(linkId);

    if (!strategy) {
      process.stderr.write(`Error: strategy not found for link ID "${linkId}"\n`);
      process.exitCode = 1;
      return;
    }

    const result = await getLivefolio().strategy.evaluate(strategy, at);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
