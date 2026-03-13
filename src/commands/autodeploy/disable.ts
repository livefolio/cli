import { getLivefolio } from "../../config.js";

export async function disableAction(linkId: string): Promise<void> {
  try {
    const lf = getLivefolio();

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

    await lf.autodeploy.disable(data.id);
    console.log(JSON.stringify({ status: "disabled", strategyLinkId: linkId }, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
