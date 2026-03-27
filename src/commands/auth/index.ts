import type { Command } from "commander";
import { loginAction } from "./login.js";
import { logoutAction } from "./logout.js";
import { statusAction } from "./status.js";

export function registerAuth(program: Command): void {
  const auth = program.command("auth").description("Livefolio authentication");

  auth
    .command("login")
    .description("Log in to Livefolio via browser OAuth")
    .option("--base-url <url>", "Livefolio base URL", "http://localhost:3000")
    .option("--no-open", "Do not try to open the browser automatically")
    .action(loginAction);

  auth
    .command("status")
    .description("Show stored CLI login status")
    .option("--base-url <url>", "Expected Livefolio base URL")
    .action(statusAction);

  auth
    .command("logout")
    .description("Delete the stored CLI login")
    .action(logoutAction);
}
