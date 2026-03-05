import { clearSession } from "../../lib/session.js";

export async function logoutAction(): Promise<void> {
  clearSession();
  console.log("Logged out");
}
