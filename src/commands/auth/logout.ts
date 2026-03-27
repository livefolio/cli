import { runStrategyAction } from "../strategy/contract.js";
import { clearStoredAuthSession } from "../../auth/session.js";

export async function logoutAction(): Promise<void> {
  await runStrategyAction(async () => {
    await clearStoredAuthSession();
    return { loggedOut: true };
  });
}
