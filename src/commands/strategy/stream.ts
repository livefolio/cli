import { getLivefolio } from "../../config.js";

export async function streamAction(
  linkId: string,
  options: { symbol?: string; price?: string; timestamp?: string },
): Promise<void> {
  try {
    const lf = getLivefolio();
    const strategy = await lf.strategy.get(linkId);

    if (!strategy) {
      process.stderr.write(`Error: strategy not found for link ID "${linkId}"\n`);
      process.exitCode = 1;
      return;
    }

    if (!options.symbol || !options.price) {
      process.stderr.write("Error: --symbol and --price are required for stream\n");
      process.exitCode = 1;
      return;
    }

    const price = Number(options.price);
    if (isNaN(price)) {
      process.stderr.write(`Error: invalid price "${options.price}"\n`);
      process.exitCode = 1;
      return;
    }

    const timestamp = options.timestamp ?? new Date().toISOString();
    if (isNaN(new Date(timestamp).getTime())) {
      process.stderr.write(`Error: invalid timestamp "${options.timestamp}"\n`);
      process.exitCode = 1;
      return;
    }

    const observation = {
      symbol: options.symbol.toUpperCase(),
      timestamp,
      value: price,
    };

    const result = await lf.strategy.stream(strategy, observation);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
