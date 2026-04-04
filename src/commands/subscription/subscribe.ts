import { getLivefolio } from "../../config.js";

export async function subscribeAction(linkId: string): Promise<void> {
  try {
    await getLivefolio().subscription.subscribe(linkId);
    console.log(JSON.stringify({ status: "subscribed", strategyLinkId: linkId }, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
