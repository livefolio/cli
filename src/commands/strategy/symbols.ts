import { getLivefolio } from "../../config.js";

export async function symbolsAction(linkId: string): Promise<void> {
  try {
    const lf = getLivefolio();
    const strategy = await lf.strategy.get(linkId);

    if (!strategy) {
      process.stderr.write(`Error: strategy not found for link ID "${linkId}"\n`);
      process.exitCode = 1;
      return;
    }

    const symbols = lf.strategy.extractSymbols(strategy);
    console.log(symbols.join('\n'));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
