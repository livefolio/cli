import { getLivefolio } from "../../config.js";

export async function statusAction(): Promise<void> {
  try {
    const deploys = await getLivefolio().autodeploy.list();
    console.log(JSON.stringify(deploys, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
