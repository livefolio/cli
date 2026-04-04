import { getLivefolio } from "../../config.js";

export async function activitiesAction(accountId: string): Promise<void> {
  try {
    const activities = await getLivefolio().broker.listActivities(accountId);
    console.log(JSON.stringify(activities, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
