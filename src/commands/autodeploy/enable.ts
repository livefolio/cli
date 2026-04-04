import { getLivefolio } from "../../config.js";

export async function enableAction(linkId: string, accountId: string): Promise<void> {
  try {
    const lf = getLivefolio();
    const strategy = await lf.strategy.get(linkId);

    if (!strategy) {
      process.stderr.write(`Error: strategy not found for link ID "${linkId}"\n`);
      process.exitCode = 1;
      return;
    }

    // Resolve linkId to numeric strategyId via the strategies table
    const { data } = await lf.supabase
      .from("strategies")
      .select("id")
      .eq("link_id", linkId)
      .limit(1)
      .single();

    if (!data) {
      process.stderr.write(`Error: strategy not found for link ID "${linkId}"\n`);
      process.exitCode = 1;
      return;
    }

    await lf.autodeploy.enable(data.id, accountId);
    console.log(JSON.stringify({ status: "enabled", strategyLinkId: linkId, accountId }, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
