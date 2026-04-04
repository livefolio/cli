import { getLivefolio } from "../../config.js";

export async function backtestAction(
  linkId: string,
  options: { start?: string; end?: string },
): Promise<void> {
  try {
    const lf = getLivefolio();
    const strategy = await lf.strategy.get(linkId);

    if (!strategy) {
      process.stderr.write(`Error: strategy not found for link ID "${linkId}"\n`);
      process.exitCode = 1;
      return;
    }

    const now = new Date();
    const startDate = options.start ?? "2020-01-01";
    const endDate = options.end ?? now.toISOString().slice(0, 10);

    if (isNaN(new Date(startDate).getTime())) {
      process.stderr.write(`Error: invalid start date "${options.start}"\n`);
      process.exitCode = 1;
      return;
    }

    if (isNaN(new Date(endDate).getTime())) {
      process.stderr.write(`Error: invalid end date "${options.end}"\n`);
      process.exitCode = 1;
      return;
    }

    const result = await lf.strategy.backtest(strategy, { startDate, endDate });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
