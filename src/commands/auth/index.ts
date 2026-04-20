import type { Command } from "commander";
import { loginAction } from "./login.js";
import { logoutAction } from "./logout.js";
import { statusAction } from "./status.js";

export function registerAuth(program: Command): void {
  const auth = program.command("auth").description("Authentication commands");

  auth.command("login").description("Log in via OAuth").action(loginAction);
  auth
    .command("logout")
    .description("Log out and clear session")
    .action(logoutAction);
  auth
    .command("status")
    .description("Show authentication status")
    .action(statusAction);
}
