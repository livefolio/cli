import type { Command } from "commander";
import { enableAction } from "./enable.js";
import { disableAction } from "./disable.js";
import { statusAction } from "./status.js";
import { confirmAction } from "./confirm.js";

export function registerAutoDeploy(program: Command): void {
  const autodeploy = program
    .command("autodeploy")
    .description("Auto-deploy commands");

  autodeploy
    .command("enable <linkId> <accountId>")
    .description("Enable auto-deploy for a strategy on an account")
    .action(enableAction);

  autodeploy
    .command("disable <linkId>")
    .description("Disable auto-deploy for a strategy")
    .action(disableAction);

  autodeploy
    .command("status")
    .description("List auto-deploy configurations")
    .action(statusAction);

  autodeploy
    .command("confirm <batchId>")
    .description("Confirm a pending order batch")
    .action(confirmAction);
}
