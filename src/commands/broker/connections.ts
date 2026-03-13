import { getLivefolio } from "../../config.js";

export async function connectionsAction(): Promise<void> {
  try {
    const connections = await getLivefolio().broker.listConnections();
    console.log(JSON.stringify(connections, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
