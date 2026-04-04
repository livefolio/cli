import { getLivefolio } from "../../config.js";

export async function connectAction(options: { redirect?: string }): Promise<void> {
  try {
    const redirect = options.redirect ?? "https://app.livefolio.dev/broker/callback";
    const url = await getLivefolio().broker.getConnectionUrl({ customRedirect: redirect });

    if (!url) {
      process.stderr.write("Error: could not generate connection portal URL\n");
      process.exitCode = 1;
      return;
    }

    console.log(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
