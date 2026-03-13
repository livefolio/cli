import { getLivefolio } from "../../config.js";

export async function unsubscribeAction(linkId: string): Promise<void> {
  try {
    await getLivefolio().subscription.unsubscribe(linkId);
    console.log(JSON.stringify({ status: "unsubscribed", strategyLinkId: linkId }, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
