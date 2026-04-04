import { getLivefolio } from "../../config.js";

export async function listAction(): Promise<void> {
  try {
    const subscriptions = await getLivefolio().subscription.list();
    console.log(JSON.stringify(subscriptions, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
