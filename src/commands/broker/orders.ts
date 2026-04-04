import { getLivefolio } from "../../config.js";

export async function ordersAction(accountId: string): Promise<void> {
  try {
    const orders = await getLivefolio().broker.listRecentOrders(accountId);
    console.log(JSON.stringify(orders, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
