import { getLivefolio } from "../../config.js";

export async function holdingsAction(accountId: string): Promise<void> {
  try {
    const holdings = await getLivefolio().broker.getHoldings(accountId);
    console.log(JSON.stringify(holdings, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
